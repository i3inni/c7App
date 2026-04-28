"""
[Part 3] FastAPI 자세 추정 서버

센서: C7 / T7 / T3 (3개, pitch + roll)
영점: 벽 캘리브레이션 (POST /calibrate)
판단: AI 분류 + 개인화 threshold (BMI + 연령 + 현재 자세 상태 실시간 스위칭)
알림: 50샘플(5초) rolling window

엔드포인트:
    POST /calibrate  — 벽 기준 baseline + BMI/나이 저장
    POST /data       — 실시간 센서 데이터 (100ms마다)
    GET  /health     — 서버 상태
"""

import os
import joblib
import numpy as np
from collections import deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

BASE_DIR    = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(BASE_DIR, "models", "posture_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler.pkl")

SENSORS = ["C7", "T7", "T3"]

POSE_META = {
    "normal":        {"kr": "바른 자세",       "is_bad": False},
    "forward_head":  {"kr": "거북목",          "is_bad": True},
    "kyphosis":      {"kr": "굽은등",          "is_bad": True},
    "lateral_tilt":  {"kr": "옆으로 기울어짐",  "is_bad": True},
}

# ─────────────────────────────────────────
# 기본 threshold (논문 기반, diff 기준)
# BMI·연령·자세 상태에 따라 이 값에서 조정됩니다.
# ─────────────────────────────────────────
BASE_THRESHOLD = {
    "C7_warn":    8.0,
    "C7_severe":  14.0,
    "T7_warn":    10.0,
    "T7_severe":  15.0,
    "T3_warn":    6.0,
    "T3_severe":  11.0,
    "roll_warn":  5.0,
    "roll_severe":10.0,
}

WINDOW_SIZE = 50  # 5초 × 10Hz


# ─────────────────────────────────────────
# 개인화 threshold 계산
# ─────────────────────────────────────────

def calc_bmi(height_cm: float, weight_kg: float) -> float:
    h = height_cm / 100
    return round(weight_kg / (h * h), 1)


def bmi_adjustment(bmi: float) -> float:
    """
    BMI가 높을수록 척추에 가해지는 하중이 커져 자세 무너짐이 빠릅니다.
    → threshold를 낮춰(더 엄격하게) 더 빨리 경고합니다.

    BMI 정상(18.5~24.9) : 0° 조정 (기본값)
    BMI 과체중(25~29.9) : -2° (조금 엄격)
    BMI 비만(30 이상)   : -4° (더 엄격)
    """
    if bmi >= 30:
        return -4.0
    elif bmi >= 25:
        return -2.0
    else:
        return 0.0


def age_adjustment(age: int) -> float:
    """
    나이가 많을수록 근력 저하로 자세 유지가 어렵습니다.
    → threshold를 낮춰 더 민감하게 감지합니다.

    20~39세 : 0°
    40~59세 : -1°
    60세 이상: -2°
    """
    if age >= 60:
        return -2.0
    elif age >= 40:
        return -1.0
    else:
        return 0.0


def state_adjustment(current_severity: str) -> float:
    """
    현재 자세 상태에 따른 실시간 threshold 스위칭.
    이미 나쁜 자세 상태라면 threshold를 낮춰 더 빨리 severe로 전환합니다.

    normal  : 0° (기본)
    warning : -1° (조금 더 민감)
    severe  : -2° (가장 민감)
    """
    if current_severity == "severe":
        return -2.0
    elif current_severity == "warning":
        return -1.0
    else:
        return 0.0


def get_thresholds(bmi: float, age: int, current_severity: str) -> dict:
    """
    세 가지 보정값을 합산해 이 요청에 적용할 최종 threshold를 반환합니다.

    최종 조정량 = bmi_adj + age_adj + state_adj
    양수 threshold(C7/T7/T3/roll)는 낮아질수록 더 엄격해집니다.
    """
    adj = bmi_adjustment(bmi) + age_adjustment(age) + state_adjustment(current_severity)

    return {
        "C7_warn":    BASE_THRESHOLD["C7_warn"]    + adj,
        "C7_severe":  BASE_THRESHOLD["C7_severe"]  + adj,
        "T7_warn":    BASE_THRESHOLD["T7_warn"]    + adj,
        "T7_severe":  BASE_THRESHOLD["T7_severe"]  + adj,
        "T3_warn":    BASE_THRESHOLD["T3_warn"]    + adj,
        "T3_severe":  BASE_THRESHOLD["T3_severe"]  + adj,
        "roll_warn":  BASE_THRESHOLD["roll_warn"]  + adj,
        "roll_severe":BASE_THRESHOLD["roll_severe"] + adj,
    }


# ─────────────────────────────────────────
# 사용자 상태
# ─────────────────────────────────────────

class UserState:
    def __init__(self):
        self.baseline_pitch: list[float] = [0.0] * 3
        self.baseline_roll:  list[float] = [0.0] * 3
        self.bmi:    float = 22.0   # 기본값: 정상 BMI
        self.age:    int   = 25     # 기본값
        self.current_severity: str = "normal"   # 실시간 자세 상태
        self.window: deque = deque(maxlen=WINDOW_SIZE)

    @property
    def window_ready(self) -> bool:
        return len(self.window) == WINDOW_SIZE

    @property
    def avg_c7_diff(self) -> float:
        return float(np.mean(self.window)) if self.window else 0.0


_users: dict[str, UserState] = {}

def get_user(uid: str) -> UserState:
    if uid not in _users:
        _users[uid] = UserState()
    return _users[uid]


# ─────────────────────────────────────────
# 모델
# ─────────────────────────────────────────

class ModelContainer:
    model  = None
    scaler = None
    is_ready = False

ml = ModelContainer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        ml.model  = joblib.load(MODEL_PATH)
        ml.scaler = joblib.load(SCALER_PATH)
        ml.is_ready = True
        print("✅ 모델 로딩 완료")
    else:
        print("⚠️  모델 없음 — python 2_train_model.py 실행 후 재시작")
    yield


app = FastAPI(
    title="C7AI 자세 추정 API",
    description="C7/T7/T3 | 벽 캘리브레이션 | BMI+연령+자세상태 실시간 threshold 스위칭",
    version="7.0.0",
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
# 스키마
# ─────────────────────────────────────────

class CalibrateRequest(BaseModel):
    user_id:    str
    height_cm:  float          # 키 (BMI 계산용)
    weight_kg:  float          # 몸무게 (BMI 계산용)
    age:        int            # 나이
    p: list[float]             # 벽 기준 pitch [C7, T7, T3]
    r: list[float]             # 벽 기준 roll  [C7, T7, T3]

    @field_validator("p", "r")
    @classmethod
    def check_len(cls, v):
        if len(v) != 3:
            raise ValueError("센서값 3개 필요 [C7, T7, T3]")
        return v


class DataRequest(BaseModel):
    type:    str  = "DATA"
    user_id: str  = "default"
    p: list[float]
    r: list[float]

    @field_validator("p", "r")
    @classmethod
    def check_len(cls, v):
        if len(v) != 3:
            raise ValueError("센서값 3개 필요 [C7, T7, T3]")
        return v


class DataResponse(BaseModel):
    # AI 분류
    pose_en:        str
    pose_kr:        str
    confidence:     float
    is_bad_posture: bool

    # 심각도 + alert
    severity:       str        # "normal" | "warning" | "severe"
    alert:          bool
    window_filled:  bool

    # 적용된 개인화 threshold 정보
    bmi:            float
    applied_adj:    float      # 총 조정값 (디버깅용)

    # 개별 센서 플래그
    c7_flag:   bool
    t7_flag:   bool
    t3_flag:   bool
    roll_flag: bool

    diff_pitch: list[float]
    diff_roll:  list[float]


# ─────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────

@app.post("/calibrate")
async def calibrate(req: CalibrateRequest):
    state = get_user(req.user_id)
    state.baseline_pitch   = req.p
    state.baseline_roll    = req.r
    state.bmi              = calc_bmi(req.height_cm, req.weight_kg)
    state.age              = req.age
    state.current_severity = "normal"
    state.window.clear()

    bmi_adj  = bmi_adjustment(state.bmi)
    age_adj  = age_adjustment(req.age)
    total_adj = bmi_adj + age_adj

    return {
        "status":    "ok",
        "user_id":   req.user_id,
        "bmi":       state.bmi,
        "bmi_adj":   bmi_adj,
        "age_adj":   age_adj,
        "total_adj": total_adj,
        "message":   f"BMI {state.bmi} / 나이 {req.age}세 → threshold 조정량: {total_adj:+.1f}°",
    }


@app.post("/data", response_model=DataResponse)
async def receive_data(req: DataRequest):
    """
    실시간 센서 데이터 처리.

    Threshold 스위칭 순서:
        1. BMI 보정   : 체중 높을수록 threshold 낮춤
        2. 연령 보정   : 나이 많을수록 threshold 낮춤
        3. 자세 상태   : 현재 warning/severe면 threshold 추가로 낮춤
        → 세 값의 합이 이번 프레임에 적용될 조정량
    """
    if not ml.is_ready:
        raise HTTPException(503, "모델 로딩 중입니다.")

    state = get_user(req.user_id)

    # ── diff 계산 ──────────────────────────────────
    dp = [req.p[i] - state.baseline_pitch[i] for i in range(3)]
    dr = [req.r[i] - state.baseline_roll[i]  for i in range(3)]
    state.window.append(dp[0])

    # ── AI 분류 ───────────────────────────────────────
    features = [v for pair in zip(dp, dr) for v in pair]
    X_scaled = ml.scaler.transform(np.array(features).reshape(1, -1))
    proba    = ml.model.predict_proba(X_scaled)[0]
    best_idx = int(np.argmax(proba))
    pose_en  = ml.model.classes_[best_idx]
    confidence = float(proba[best_idx]) * 100.0
    meta = POSE_META.get(pose_en, {"kr": pose_en, "is_bad": True})

    # ── 개인화 threshold 계산 (3가지 보정 합산) ────────
    th = get_thresholds(state.bmi, state.age, state.current_severity)
    adj = (bmi_adjustment(state.bmi)
           + age_adjustment(state.age)
           + state_adjustment(state.current_severity))

    # ── 논문 threshold 체크 ───────────────────────────
    c7_flag   = dp[0] >= th["C7_warn"]
    t7_flag   = dp[1] >= th["T7_warn"]
    t3_flag   = dp[2] >= th["T3_warn"]
    roll_flag = max(abs(v) for v in dr) >= th["roll_warn"]

    # ── 심각도 판단 ───────────────────────────────────
    if (dp[0] >= th["C7_severe"]
            or dp[1] >= th["T7_severe"]
            or dp[2] >= th["T3_severe"]
            or max(abs(v) for v in dr) >= th["roll_severe"]):
        severity = "severe"
    elif c7_flag or t7_flag or t3_flag or roll_flag or meta["is_bad"]:
        severity = "warning"
    else:
        severity = "normal"

    # ── 자세 상태 업데이트 (다음 프레임 threshold 스위칭용) ──
    state.current_severity = severity

    # ── 5초 rolling window alert ─────────────────────
    avg_c7 = state.avg_c7_diff
    alert  = state.window_ready and (avg_c7 >= th["C7_warn"] or severity == "severe")

    return DataResponse(
        pose_en        = pose_en,
        pose_kr        = meta["kr"],
        confidence     = round(confidence, 1),
        is_bad_posture = meta["is_bad"],
        severity       = severity,
        alert          = alert,
        window_filled  = state.window_ready,
        bmi            = state.bmi,
        applied_adj    = round(adj, 1),
        c7_flag        = c7_flag,
        t7_flag        = t7_flag,
        t3_flag        = t3_flag,
        roll_flag      = roll_flag,
        diff_pitch     = [round(v, 1) for v in dp],
        diff_roll      = [round(v, 1) for v in dr],
    )


@app.get("/health")
async def health():
    return {
        "status":       "ok",
        "model_ready":  ml.is_ready,
        "active_users": len(_users),
        "sensors":      SENSORS,
        "window_size":  WINDOW_SIZE,
    }


@app.get("/")
async def root():
    return {
        "service":   "C7AI 자세 추정 API v7",
        "sensors":   SENSORS,
        "calibrate": "POST /calibrate  (벽 기준 + BMI + 나이)",
        "data":      "POST /data       (100ms마다)",
        "docs":      "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*55)
    print(" C7AI 자세 추정 서버 v7")
    print(" BMI + 연령 + 자세상태 실시간 threshold 스위칭")
    print(" 센서: C7 / T7 / T3")
    print("="*55 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
