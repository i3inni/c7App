"""
[Part 3] FastAPI 자세 추정 서버 v9

식별 구조:
  deviceId = WiFi MAC (소문자, 콜론 없음) — 하드웨어 식별
  userId   = guest UUID 또는 Firebase UID — 사용자 식별
  → 동일 기기를 여러 사용자가 사용해도 캘리브레이션/통계 분리

센서: C7 / T7 / T3 (3개, pitch + roll)
영점: 벽 캘리브레이션 (POST /calibrate) → Firestore 영속화
판단: AI 분류 + 개인화 threshold (BMI + 연령 + 현재 자세 상태)
알림: 50샘플 rolling window

엔드포인트:
    POST /calibrate         — 벽 기준 baseline + BMI/나이 저장
    POST /data              — 실시간 센서 데이터 (HTTP 직접 전송 / BLE fallback 릴레이)
    GET  /health            — 서버 상태
"""

import os
import asyncio
import joblib
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

load_dotenv()

from posture_engine import (
    ml, get_state, calc_bmi, bmi_adjustment, age_adjustment,
    apply_calibration, run_inference, SENSORS,
)
from mqtt_client import mqtt_listener, register_collection_session, unregister_collection_session
from firestore_writer import (
    save_calibration, save_training_sample, fetch_training_samples,
    aggregate_weekly_stats,
)
from auto_trainer import retrain, FEATURE_COLS

BASE_DIR = os.path.dirname(__file__)
CURRENT_MODEL_PATH  = os.path.join(BASE_DIR, "models", "current", "posture_model.pkl")
CURRENT_SCALER_PATH = os.path.join(BASE_DIR, "models", "current", "scaler.pkl")
DEFAULT_MODEL_PATH  = os.path.join(BASE_DIR, "models", "default", "posture_model.pkl")
DEFAULT_SCALER_PATH = os.path.join(BASE_DIR, "models", "default", "scaler.pkl")
LEGACY_MODEL_PATH   = os.path.join(BASE_DIR, "models", "posture_model.pkl")
LEGACY_SCALER_PATH  = os.path.join(BASE_DIR, "models", "scaler.pkl")


def resolve_model_paths() -> tuple[str, str, str] | None:
    candidates = [
        ("current", CURRENT_MODEL_PATH, CURRENT_SCALER_PATH),
        ("default", DEFAULT_MODEL_PATH, DEFAULT_SCALER_PATH),
        ("legacy", LEGACY_MODEL_PATH, LEGACY_SCALER_PATH),
    ]
    for source, model_path, scaler_path in candidates:
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            return source, model_path, scaler_path
    return None


# ─────────────────────────────────────────
# 스키마
# ─────────────────────────────────────────

class CalibrateRequest(BaseModel):
    mac:       str          # WiFi MAC (소문자, 콜론 없음). 예: "a4cf12987711"
    user_id:   str          # guest UUID 또는 Firebase UID
    height_cm: float
    weight_kg: float
    age:       int
    p: list[float]          # 벽 기준 pitch [C7, T3, T7]
    r: list[float]          # 벽 기준 roll  [C7, T3, T7]

    @field_validator("p", "r")
    @classmethod
    def check_len(cls, v):
        if len(v) != 3:
            raise ValueError("센서값 3개 필요 [C7, T7, T3]")
        return v

    @field_validator("mac")
    @classmethod
    def normalize_mac(cls, v):
        cleaned = v.replace(":", "").lower()
        if len(cleaned) != 12 or not all(c in "0123456789abcdef" for c in cleaned):
            raise ValueError("mac은 12자리 hex 문자열이어야 합니다. 예: a4cf12987711")
        return cleaned

    @field_validator("user_id")
    @classmethod
    def check_user_id(cls, v):
        if not v or len(v) > 128:
            raise ValueError("user_id가 비어 있거나 너무 깁니다.")
        return v


POSE_LABELS  = ["normal", "forward_head", "kyphosis", "lateral_tilt"]
COLLECT_SEC  = 300  # 자세당 수집 시간 (초)


class PoseCollectRequest(BaseModel):
    device_id:   str
    user_id:     str
    label:       str
    baseline_p:  list[float]   # 캘리브레이션 baseline pitch [C7, T3, T7]
    baseline_r:  list[float]   # 캘리브레이션 baseline roll  [C7, T3, T7]
    duration_sec: int = COLLECT_SEC

    @field_validator("label")
    @classmethod
    def check_label(cls, v):
        if v not in POSE_LABELS:
            raise ValueError(f"label은 {POSE_LABELS} 중 하나여야 합니다")
        return v

    @field_validator("baseline_p", "baseline_r")
    @classmethod
    def check_len(cls, v):
        if len(v) != 3:
            raise ValueError("baseline은 3개 값 필요 [C7, T3, T7]")
        return v


class DataRequest(BaseModel):
    mac:     str = "default"
    user_id: str = "unknown"
    p: list[float]
    r: list[float]

    @field_validator("p", "r")
    @classmethod
    def check_len(cls, v):
        if len(v) != 3:
            raise ValueError("센서값 3개 필요 [C7, T7, T3]")
        return v


class DataResponse(BaseModel):
    pose_en:        str
    pose_kr:        str
    confidence:     float
    is_bad_posture: bool
    severity:       str
    alert:          bool
    window_filled:  bool
    bmi:            float
    applied_adj:    float
    c7_flag:        bool
    t7_flag:        bool
    t3_flag:        bool
    roll_flag:      bool
    diff_pitch:     list[float]
    diff_roll:      list[float]


# ─────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────

async def _midnight_scheduler() -> None:
    """매일 UTC 자정 직후 전날 daily_stats → weekly_stats 집계."""
    # 서버 시작 시 어제 집계 (누락 방지)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    print(f"⏰ 서버 시작 시 소급 집계: {yesterday.strftime('%Y-%m-%d')}")
    await aggregate_weekly_stats(yesterday.replace(tzinfo=None))

    while True:
        now = datetime.now(timezone.utc)
        next_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=1, second=0, microsecond=0
        )
        wait_secs = (next_midnight - now).total_seconds()
        print(f"⏰ 다음 weekly 집계까지 {wait_secs / 3600:.1f}h ({next_midnight.strftime('%Y-%m-%d %H:%M')} UTC)")
        await asyncio.sleep(wait_secs)

        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        print(f"⏰ weekly_stats 집계 시작: {yesterday.strftime('%Y-%m-%d')}")
        await aggregate_weekly_stats(yesterday.replace(tzinfo=None))


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_paths = resolve_model_paths()
    if model_paths:
        source, model_path, scaler_path = model_paths
        ml.model    = joblib.load(model_path)
        ml.scaler   = joblib.load(scaler_path)
        ml.is_ready = True
        print(f"✅ 모델 로딩 완료 ({source}: {model_path})")
    else:
        print("⚠️  모델 없음 — python 2_train_model.py 실행 후 재시작")

    mqtt_task      = asyncio.create_task(mqtt_listener())
    scheduler_task = asyncio.create_task(_midnight_scheduler())
    print("✅ MQTT 리스너 시작")
    print("✅ 자정 weekly 집계 스케줄러 시작")

    yield

    mqtt_task.cancel()
    scheduler_task.cancel()
    with suppress(asyncio.CancelledError):
        await mqtt_task
    with suppress(asyncio.CancelledError):
        await scheduler_task


app = FastAPI(
    title="C7AI 자세 추정 API",
    description="C7/T7/T3 | 벽 캘리브레이션 | BMI+연령+자세상태 | MQTT | deviceId+userId 분리 식별",
    version="9.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────

@app.post("/calibrate")
async def calibrate(req: CalibrateRequest):
    """
    벽 기준 캘리브레이션.
    in-memory DeviceState 업데이트 + Firestore 영속화.
    서버 재시작 후에도 캘리브레이션 유지됨.
    """
    bmi = calc_bmi(req.height_cm, req.weight_kg)

    cal_data = {
        "baseline_pitch": req.p,
        "baseline_roll":  req.r,
        "bmi":            bmi,
        "age":            req.age,
        "height_cm":      req.height_cm,
        "weight_kg":      req.weight_kg,
    }

    # in-memory 적용
    apply_calibration(req.mac, req.user_id, cal_data)
    state = get_state(req.mac, req.user_id)
    state.current_severity = "normal"
    state.window.clear()

    # Firestore 영속화 (비동기)
    await save_calibration(req.mac, req.user_id, cal_data)

    bmi_adj   = bmi_adjustment(bmi)
    age_adj   = age_adjustment(req.age)
    total_adj = bmi_adj + age_adj

    return {
        "status":    "ok",
        "mac":       req.mac,
        "user_id":   req.user_id,
        "bmi":       bmi,
        "bmi_adj":   bmi_adj,
        "age_adj":   age_adj,
        "total_adj": total_adj,
        "message":   f"BMI {bmi} / {req.age}세 → threshold 조정량: {total_adj:+.1f}°",
    }


@app.post("/data", response_model=DataResponse)
async def receive_data(req: DataRequest):
    """
    HTTP 직접 전송용.
    BLE fallback 시 RN 앱이 이 엔드포인트로 relay하는 용도로도 사용합니다.
    """
    if not ml.is_ready:
        raise HTTPException(503, "모델 로딩 중입니다.")

    result = run_inference(req.mac, req.user_id, req.p, req.r)
    return DataResponse(**result)


@app.get("/health")
async def health():
    from mqtt_client import MQTT_HOST, MQTT_PORT
    return {
        "status":      "ok",
        "model_ready": ml.is_ready,
        "mqtt_target": f"{MQTT_HOST}:{MQTT_PORT}",
        "sensors":     SENSORS,
        "version":     "9.0.0",
    }


@app.post("/pose-calibration/baseline")
async def pose_calibration_baseline(body: dict):
    """
    device_id 기기에서 N초간 데이터를 수집해 baseline(평균 pitch/roll)을 반환합니다.
    CalibrationScreen 시작 시 한 번 호출합니다.
    """
    device_id    = body.get("device_id", "")
    duration_sec = int(body.get("duration_sec", 5))

    queue: asyncio.Queue = asyncio.Queue()
    register_collection_session(device_id, queue)

    frames: list[tuple] = []
    deadline = asyncio.get_event_loop().time() + duration_sec
    try:
        while asyncio.get_event_loop().time() < deadline:
            remaining = deadline - asyncio.get_event_loop().time()
            try:
                p, r = await asyncio.wait_for(queue.get(), timeout=min(remaining, 3.0))
                frames.append((p, r))
            except asyncio.TimeoutError:
                break
    finally:
        unregister_collection_session(device_id)

    if not frames:
        raise HTTPException(422, "센서 데이터를 수신하지 못했습니다.")

    n  = len(frames)
    bp = [sum(f[0][i] for f in frames) / n for i in range(3)]
    br = [sum(f[1][i] for f in frames) / n for i in range(3)]
    return {"baseline_p": bp, "baseline_r": br, "frames": n}


@app.post("/pose-calibration/collect")
async def pose_calibration_collect(req: PoseCollectRequest):
    """
    자세 하나의 센서 데이터를 수집해 Firestore training_samples에 저장합니다.
    앱 캘리브레이션 화면에서 자세마다 한 번씩 호출합니다.
    """
    queue: asyncio.Queue = asyncio.Queue()
    register_collection_session(req.device_id, queue)

    frames: list[tuple] = []
    deadline = asyncio.get_event_loop().time() + req.duration_sec
    try:
        while asyncio.get_event_loop().time() < deadline:
            remaining = deadline - asyncio.get_event_loop().time()
            try:
                p, r = await asyncio.wait_for(queue.get(), timeout=min(remaining, 3.0))
                frames.append((p, r))
            except asyncio.TimeoutError:
                break
    finally:
        unregister_collection_session(req.device_id)

    if not frames:
        raise HTTPException(422, "센서 데이터를 수신하지 못했습니다. 기기가 연결됐는지 확인하세요.")

    # baseline diff 계산 → 피처 생성 → Firestore 저장 (guided: 사람이 직접 수집)
    saved = 0
    for p, r in frames:
        dp = [p[i] - req.baseline_p[i] for i in range(3)]
        dr = [r[i] - req.baseline_r[i] for i in range(3)]
        features = [v for pair in zip(dp, dr) for v in pair]
        await save_training_sample(
            req.user_id, req.label, features,
            source="guided",
            label_source="human",
            confidence=1.0,
            device_id=req.device_id,
            approved_for_training=True,
        )
        saved += 1

    return {"status": "ok", "label": req.label, "collected": saved}


@app.post("/pose-calibration/train")
async def pose_calibration_train():
    """
    guided 샘플(사람이 직접 수집, approved=True)로만 모델을 재학습하고 핫 리로드합니다.
    캘리브레이션 마지막 단계에서 한 번만 호출합니다.
    """
    rows = await fetch_training_samples(sources=["guided"], approved_only=True)
    if not rows:
        raise HTTPException(422, "학습 데이터가 없습니다. 먼저 /pose-calibration/collect를 실행하세요.")

    # FEATURE_COLS에 해당하는 키가 모두 있는 행만 사용
    valid_rows = [r for r in rows if all(f in r for f in FEATURE_COLS) and "label" in r]
    if not valid_rows:
        raise HTTPException(422, "유효한 학습 샘플이 없습니다.")

    result = await retrain(valid_rows)
    status = "promoted" if result["promoted"] else "rejected"
    return {"status": status, **result}


@app.get("/")
async def root():
    return {
        "service":   "C7AI 자세 추정 API v9",
        "sensors":   SENSORS,
        "calibrate": "POST /calibrate  { mac, user_id, height_cm, weight_kg, age, p, r }",
        "data":      "POST /data        { mac, user_id, p, r }",
        "mqtt_sub":  "posture/+/raw  자동 구독 중 (payload에 userId 포함)",
        "mqtt_pub":  "posture/{deviceId}/result  |  posture/{deviceId}/alert",
        "docs":      "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print(" C7AI 자세 추정 서버 v9")
    print(" deviceId(MAC) + userId(guest/Firebase) 분리 식별")
    print(" MQTT: posture/+/raw 구독 | result/alert publish")
    print(" 센서: C7 / T7 / T3")
    print("=" * 60 + "\n")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
