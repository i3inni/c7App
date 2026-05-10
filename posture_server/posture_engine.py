"""
공유 자세 처리 엔진.
3_server.py (HTTP 엔드포인트) 와 mqtt_client.py (MQTT 구독자) 양쪽에서 import합니다.

식별 구조:
  deviceId = WiFi MAC 주소 (소문자, 콜론 없음) — 하드웨어 식별
  userId   = guest UUID 또는 Firebase UID      — 사용자 식별

DeviceState 키 = "{deviceId}:{userId}" 조합
→ 동일 기기를 여러 사용자가 사용해도 캘리브레이션/rolling window 분리됨.
"""

import numpy as np
from collections import deque

SENSORS = ["C7", "T7", "T3"]

POSE_META = {
    "normal":       {"kr": "바른 자세",       "is_bad": False},
    "forward_head": {"kr": "거북목",          "is_bad": True},
    "kyphosis":     {"kr": "굽은등",          "is_bad": True},
    "lateral_tilt": {"kr": "옆으로 기울어짐",  "is_bad": True},
}

BASE_THRESHOLD = {
    "C7_warn":     8.0,
    "C7_severe":  14.0,
    "T7_warn":    10.0,
    "T7_severe":  15.0,
    "T3_warn":     6.0,
    "T3_severe":  11.0,
    "roll_warn":   5.0,
    "roll_severe": 10.0,
}

WINDOW_SIZE = 50


# ── threshold 계산 ──────────────────────────────────────

def calc_bmi(height_cm: float, weight_kg: float) -> float:
    h = height_cm / 100
    return round(weight_kg / (h * h), 1)


def bmi_adjustment(bmi: float) -> float:
    if bmi >= 30: return -4.0
    if bmi >= 25: return -2.0
    return 0.0


def age_adjustment(age: int) -> float:
    if age >= 60: return -2.0
    if age >= 40: return -1.0
    return 0.0


def state_adjustment(current_severity: str) -> float:
    if current_severity == "severe":  return -2.0
    if current_severity == "warning": return -1.0
    return 0.0


def get_thresholds(bmi: float, age: int, current_severity: str) -> dict:
    adj = bmi_adjustment(bmi) + age_adjustment(age) + state_adjustment(current_severity)
    return {k: v + adj for k, v in BASE_THRESHOLD.items()}


# ── 사용자-기기 조합 상태 ────────────────────────────────

class DeviceState:
    def __init__(self):
        self.baseline_pitch: list[float] = [0.0] * 3
        self.baseline_roll:  list[float] = [0.0] * 3
        self.bmi:    float = 22.0
        self.age:    int   = 25
        self.current_severity: str = "normal"
        self.window: deque = deque(maxlen=WINDOW_SIZE)

    @property
    def window_ready(self) -> bool:
        return len(self.window) == WINDOW_SIZE

    @property
    def avg_c7_diff(self) -> float:
        return float(np.mean(self.window)) if self.window else 0.0


# 키: "{device_id}:{user_id}"
_states: dict[str, DeviceState] = {}


def _state_key(device_id: str, user_id: str) -> str:
    return f"{device_id}:{user_id}"


def get_state(device_id: str, user_id: str) -> DeviceState:
    key = _state_key(device_id, user_id)
    if key not in _states:
        _states[key] = DeviceState()
    return _states[key]


def apply_calibration(device_id: str, user_id: str, cal: dict) -> None:
    """Firestore에서 복원한 캘리브레이션을 in-memory 상태에 적용합니다."""
    state = get_state(device_id, user_id)
    state.baseline_pitch = cal.get("baseline_pitch", [0.0, 0.0, 0.0])
    state.baseline_roll  = cal.get("baseline_roll",  [0.0, 0.0, 0.0])
    state.bmi            = cal.get("bmi", 22.0)
    state.age            = cal.get("age", 25)


# ── ML 모델 컨테이너 ────────────────────────────────────

class ModelContainer:
    model    = None
    scaler   = None
    is_ready = False


ml = ModelContainer()


# ── 핵심 추론 함수 ──────────────────────────────────────

def run_inference(device_id: str, user_id: str, p: list[float], r: list[float]) -> dict:
    """
    센서 데이터로 자세를 추론합니다.
    device_id: MAC 주소 (소문자, 콜론 없음)
    user_id:   guest UUID 또는 Firebase UID
    p, r 순서: [C7, T7, T3]
    """
    state = get_state(device_id, user_id)

    dp = [p[i] - state.baseline_pitch[i] for i in range(3)]
    dr = [r[i] - state.baseline_roll[i]  for i in range(3)]
    state.window.append(dp[0])

    features = [v for pair in zip(dp, dr) for v in pair]
    X_scaled = ml.scaler.transform(np.array(features).reshape(1, -1))
    proba    = ml.model.predict_proba(X_scaled)[0]
    best_idx = int(np.argmax(proba))
    pose_en  = ml.model.classes_[best_idx]
    confidence = float(proba[best_idx]) * 100.0
    meta = POSE_META.get(pose_en, {"kr": pose_en, "is_bad": True})

    th  = get_thresholds(state.bmi, state.age, state.current_severity)
    adj = bmi_adjustment(state.bmi) + age_adjustment(state.age) + state_adjustment(state.current_severity)

    c7_flag   = dp[0] >= th["C7_warn"]
    t7_flag   = dp[1] >= th["T7_warn"]
    t3_flag   = dp[2] >= th["T3_warn"]
    roll_flag = max(abs(v) for v in dr) >= th["roll_warn"]

    if (dp[0] >= th["C7_severe"] or dp[1] >= th["T7_severe"]
            or dp[2] >= th["T3_severe"]
            or max(abs(v) for v in dr) >= th["roll_severe"]):
        severity = "severe"
    elif c7_flag or t7_flag or t3_flag or roll_flag or meta["is_bad"]:
        severity = "warning"
    else:
        severity = "normal"

    state.current_severity = severity

    alert = state.window_ready and (state.avg_c7_diff >= th["C7_warn"] or severity == "severe")

    return {
        "pose_en":        pose_en,
        "pose_kr":        meta["kr"],
        "confidence":     round(confidence, 1),
        "is_bad_posture": meta["is_bad"],
        "severity":       severity,
        "alert":          alert,
        "window_filled":  state.window_ready,
        "bmi":            state.bmi,
        "applied_adj":    round(adj, 1),
        "c7_flag":        c7_flag,
        "t7_flag":        t7_flag,
        "t3_flag":        t3_flag,
        "roll_flag":      roll_flag,
        "diff_pitch":     [round(v, 1) for v in dp],
        "diff_roll":      [round(v, 1) for v in dr],
    }


def compute_score(severity: str, diff_c7: float) -> int:
    """C7 각도 차이 + severity → 0-100 자세 점수"""
    base = max(0, 100 - diff_c7 * 5)
    if severity == "severe":  return max(20, int(base * 0.6))
    if severity == "warning": return max(40, int(base * 0.85))
    return min(100, int(base))
