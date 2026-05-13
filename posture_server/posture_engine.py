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
from dataclasses import dataclass
from typing import Literal, Dict, Optional

from features import build_features

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

Severity    = Literal["normal", "warning", "severe"]
PostureMode = Literal["sitting", "standing"]


# ── 새 스코어링 dataclass ────────────────────────────────

@dataclass
class SensorAngles:
    pitch: float
    roll:  float


@dataclass
class PostureBaseline:
    c7_pitch: float
    t3_pitch: float
    t7_pitch: float
    c7_roll:  float
    t3_roll:  float
    t7_roll:  float
    mode:     PostureMode


@dataclass
class UserProfile:
    age: Optional[int]   = None
    bmi: Optional[float] = None


# ── threshold 계산 (alert용, 기존 유지) ─────────────────

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


# ── 새 스코어링 헬퍼 ────────────────────────────────────

def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def get_risk_modifier(profile: UserProfile) -> float:
    modifier = 1.0
    if profile.age is not None:
        if profile.age >= 60:
            modifier += 0.10
        elif profile.age >= 40:
            modifier += 0.05
    if profile.bmi is not None:
        if profile.bmi >= 30:
            modifier += 0.12
        elif profile.bmi >= 25:
            modifier += 0.06
    return clamp(modifier, 1.0, 1.20)


def make_interpretation(
    severity: Severity,
    mode_mismatch: bool,
    neck_delta: float,
    thoracic_delta: float,
    diff_lateral: float,
    warning_neck: float,
    severe_neck: float,
    warning_thoracic: float,
    severe_thoracic: float,
    warning_lateral: float,
    severe_lateral: float,
) -> str:
    messages = []

    if mode_mismatch:
        messages.append(
            "baseline 측정 자세와 현재 측정 자세가 달라 점수 신뢰도가 낮을 수 있습니다."
        )

    if neck_delta > 0:
        if abs(neck_delta) >= severe_neck:
            messages.append("목 전방 기울어짐 변화가 크게 나타났습니다.")
        elif abs(neck_delta) >= warning_neck:
            messages.append("목 전방 기울어짐 변화가 약간 있습니다.")
    else:
        if abs(neck_delta) >= severe_neck:
            messages.append("목이 뒤로 젖혀진 변화가 크게 나타났습니다.")
        elif abs(neck_delta) >= warning_neck:
            messages.append("목이 뒤로 젖혀진 변화가 약간 있습니다.")

    if thoracic_delta > 0:
        if abs(thoracic_delta) >= severe_thoracic:
            messages.append("상부 흉추 굽음 변화가 크게 나타났습니다.")
        elif abs(thoracic_delta) >= warning_thoracic:
            messages.append("상부 흉추 굽음 변화가 약간 있습니다.")
    else:
        if abs(thoracic_delta) >= severe_thoracic:
            messages.append("상부 흉추가 과하게 펴진 변화가 나타났습니다.")
        elif abs(thoracic_delta) >= warning_thoracic:
            messages.append("상부 흉추가 평소보다 펴진 변화가 있습니다.")

    if diff_lateral >= severe_lateral:
        messages.append("좌우 기울어짐 변화가 크게 나타났습니다.")
    elif diff_lateral >= warning_lateral:
        messages.append("좌우 기울어짐 변화가 약간 있습니다.")

    if not messages:
        messages.append("baseline 대비 자세 변화가 크지 않습니다.")

    return " ".join(messages)


# ── 핵심 스코어 계산 (교체된 로직) ──────────────────────

def compute_score(
    c7: SensorAngles,
    t3: SensorAngles,
    t7: SensorAngles,
    baseline: PostureBaseline,
    profile: UserProfile = UserProfile(),
    mode: PostureMode = "sitting",
) -> Dict:
    mode_mismatch = baseline.mode != mode

    neck_flexion    = c7.pitch - t3.pitch
    thoracic_curve  = t3.pitch - t7.pitch

    lateral_tilt = (
        abs(c7.roll - baseline.c7_roll) * 0.30 +
        abs(t3.roll - baseline.t3_roll) * 0.40 +
        abs(t7.roll - baseline.t7_roll) * 0.30
    )

    base_neck_flexion   = baseline.c7_pitch - baseline.t3_pitch
    base_thoracic_curve = baseline.t3_pitch - baseline.t7_pitch

    neck_delta      = neck_flexion   - base_neck_flexion
    thoracic_delta  = thoracic_curve - base_thoracic_curve

    diff_neck      = abs(neck_delta)
    diff_thoracic  = abs(thoracic_delta)
    diff_lateral   = lateral_tilt

    if neck_delta > 0:
        neck_effective      = max(0, neck_delta - 4)
        neck_penalty_scale  = 4.2
        neck_direction      = "forward"
    else:
        neck_effective      = max(0, -neck_delta - 6)
        neck_penalty_scale  = 2.0
        neck_direction      = "backward"

    if thoracic_delta > 0:
        thoracic_effective     = max(0, thoracic_delta - 4)
        thoracic_penalty_scale = 3.4
        thoracic_direction     = "kyphosis_increase"
    else:
        thoracic_effective     = max(0, -thoracic_delta - 6)
        thoracic_penalty_scale = 1.5
        thoracic_direction     = "extension"

    lateral_effective = max(0, diff_lateral - 2)

    neck_penalty     = neck_effective     * neck_penalty_scale
    thoracic_penalty = thoracic_effective * thoracic_penalty_scale
    lateral_penalty  = lateral_effective  * 3.2

    risk_modifier = get_risk_modifier(profile)

    total_penalty = (
        neck_penalty     * 0.45 +
        thoracic_penalty * 0.35 +
        lateral_penalty  * 0.20
    ) * risk_modifier

    raw_score = 100 - total_penalty
    score     = int(clamp(raw_score, 0, 100))

    threshold_factor = 1.0 + (risk_modifier - 1.0) * 0.5

    warning_neck      = 8  / threshold_factor
    severe_neck       = 15 / threshold_factor
    warning_thoracic  = 8  / threshold_factor
    severe_thoracic   = 15 / threshold_factor
    warning_lateral   = 7  / threshold_factor
    severe_lateral    = 12 / threshold_factor

    forward_neck_risk        = neck_delta > 0      and diff_neck     >= warning_neck
    severe_forward_neck_risk = neck_delta > 0      and diff_neck     >= severe_neck
    kyphosis_risk            = thoracic_delta > 0  and diff_thoracic >= warning_thoracic
    severe_kyphosis_risk     = thoracic_delta > 0  and diff_thoracic >= severe_thoracic
    lateral_risk             = diff_lateral >= warning_lateral
    severe_lateral_risk      = diff_lateral >= severe_lateral

    if (
        score < 60
        or severe_forward_neck_risk
        or severe_kyphosis_risk
        or severe_lateral_risk
    ):
        severity: Severity = "severe"
    elif (
        score < 80
        or forward_neck_risk
        or kyphosis_risk
        or lateral_risk
    ):
        severity = "warning"
    else:
        severity = "normal"

    score_confidence = 0.5 if mode_mismatch else 1.0

    return {
        "score":            score,
        "severity":         severity,
        "score_confidence": score_confidence,
        "risk_modifier":    round(risk_modifier, 2),
        "threshold_factor": round(threshold_factor, 2),
        "mode_warning":     mode_mismatch,
        "features": {
            "neck_flexion_proxy":    round(neck_flexion,   2),
            "thoracic_curve_proxy":  round(thoracic_curve, 2),
            "lateral_tilt_proxy":    round(lateral_tilt,   2),
            "neck_delta":            round(neck_delta,      2),
            "thoracic_delta":        round(thoracic_delta,  2),
            "diff_neck":             round(diff_neck,       2),
            "diff_thoracic":         round(diff_thoracic,   2),
            "diff_lateral":          round(diff_lateral,    2),
            "neck_direction":        neck_direction,
            "thoracic_direction":    thoracic_direction,
        },
        "penalties": {
            "neck_penalty":     round(neck_penalty,     2),
            "thoracic_penalty": round(thoracic_penalty, 2),
            "lateral_penalty":  round(lateral_penalty,  2),
            "total_penalty":    round(total_penalty,    2),
        },
        "thresholds": {
            "warning_neck":     round(warning_neck,     2),
            "severe_neck":      round(severe_neck,      2),
            "warning_thoracic": round(warning_thoracic, 2),
            "severe_thoracic":  round(severe_thoracic,  2),
            "warning_lateral":  round(warning_lateral,  2),
            "severe_lateral":   round(severe_lateral,   2),
        },
        "interpretation": make_interpretation(
            severity=severity,
            mode_mismatch=mode_mismatch,
            neck_delta=neck_delta,
            thoracic_delta=thoracic_delta,
            diff_lateral=diff_lateral,
            warning_neck=warning_neck,
            severe_neck=severe_neck,
            warning_thoracic=warning_thoracic,
            severe_thoracic=severe_thoracic,
            warning_lateral=warning_lateral,
            severe_lateral=severe_lateral,
        ),
    }


# ── 핵심 추론 함수 ──────────────────────────────────────

def run_inference(device_id: str, user_id: str, p: list[float], r: list[float]) -> dict:
    """
    센서 데이터로 자세를 추론합니다.
    device_id: MAC 주소 (소문자, 콜론 없음)
    user_id:   guest UUID 또는 Firebase UID
    p, r 순서: [C7, T3, T7]  (SensorBuffer.extract() 반환 순서)
    """
    state = get_state(device_id, user_id)

    dp = [p[i] - state.baseline_pitch[i] for i in range(3)]
    dr = [r[i] - state.baseline_roll[i]  for i in range(3)]
    state.window.append(dp[0])

    # ML 분류 — raw + 파생 feature 11개
    features = build_features(dp, dr)
    X_scaled = ml.scaler.transform(np.array(features).reshape(1, -1))
    proba    = ml.model.predict_proba(X_scaled)[0]
    best_idx = int(np.argmax(proba))
    pose_en  = ml.model.classes_[best_idx]
    confidence = float(proba[best_idx]) * 100.0
    meta = POSE_META.get(pose_en, {"kr": pose_en, "is_bad": True})

    # 새 스코어링 로직 호출
    # p 순서: [C7, T3, T7] (SensorBuffer.extract() 반환 순서)
    score_result = compute_score(
        c7       = SensorAngles(pitch=p[0], roll=r[0]),
        t3       = SensorAngles(pitch=p[1], roll=r[1]),
        t7       = SensorAngles(pitch=p[2], roll=r[2]),
        baseline = PostureBaseline(
            c7_pitch = state.baseline_pitch[0],
            t3_pitch = state.baseline_pitch[1],
            t7_pitch = state.baseline_pitch[2],
            c7_roll  = state.baseline_roll[0],
            t3_roll  = state.baseline_roll[1],
            t7_roll  = state.baseline_roll[2],
            mode     = "sitting",
        ),
        profile = UserProfile(age=state.age, bmi=state.bmi),
    )

    severity = score_result["severity"]
    state.current_severity = severity

    # 기존 rolling window 기반 alert 유지
    th    = get_thresholds(state.bmi, state.age, severity)
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
        "applied_adj":    score_result["risk_modifier"],
        "c7_flag":        score_result["features"]["neck_delta"] > 0,
        "t7_flag":        abs(score_result["features"]["thoracic_delta"]) >= th["T7_warn"],
        "t3_flag":        score_result["features"]["thoracic_delta"] > 0,
        "roll_flag":      score_result["features"]["diff_lateral"] >= th["roll_warn"],
        "diff_pitch":     [round(v, 1) for v in dp],
        "diff_roll":      [round(v, 1) for v in dr],
        "score":          score_result["score"],
    }
