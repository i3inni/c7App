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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

load_dotenv()

from posture_engine import (
    ml, get_state, calc_bmi, bmi_adjustment, age_adjustment,
    apply_calibration, run_inference, SENSORS,
)
from mqtt_client import mqtt_listener
from firestore_writer import save_calibration

BASE_DIR    = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(BASE_DIR, "models", "posture_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler.pkl")


# ─────────────────────────────────────────
# 스키마
# ─────────────────────────────────────────

class CalibrateRequest(BaseModel):
    mac:       str          # WiFi MAC (소문자, 콜론 없음). 예: "a4cf12987711"
    user_id:   str          # guest UUID 또는 Firebase UID
    height_cm: float
    weight_kg: float
    age:       int
    p: list[float]          # 벽 기준 pitch [C7, T7, T3]
    r: list[float]          # 벽 기준 roll  [C7, T7, T3]

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        ml.model    = joblib.load(MODEL_PATH)
        ml.scaler   = joblib.load(SCALER_PATH)
        ml.is_ready = True
        print("✅ 모델 로딩 완료")
    else:
        print("⚠️  모델 없음 — python 2_train_model.py 실행 후 재시작")

    mqtt_task = asyncio.create_task(mqtt_listener())
    print("✅ MQTT 리스너 시작")

    yield

    mqtt_task.cancel()
    with suppress(asyncio.CancelledError):
        await mqtt_task


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
