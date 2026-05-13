"""
feature 정의 및 생성 공용 모듈.

모든 파일(학습/추론/저장)이 이 모듈을 import해서 feature 순서를 일치시킨다.

저장 (CSV / Firestore) : RAW_FEATURE_COLS  — 6개 raw diff 값만 저장
학습 / 추론            : FEATURE_COLS      — raw 6개 + 파생 5개 = 11개
"""

import math

SENSORS = ["C7", "T3", "T7"]

# Firestore / CSV 저장용 (raw만)
RAW_FEATURE_COLS = [f"diff_{s}_{ax}" for s in SENSORS for ax in ("pitch", "roll")]

# 파생 feature 이름
DERIVED_FEATURE_COLS = [
    "neck_flexion_diff",    # C7_pitch - T3_pitch  (목이 얼마나 앞으로 굽었나)
    "thoracic_curve_diff",  # T3_pitch - T7_pitch  (등이 얼마나 굽었나)
    "lateral_asymmetry",    # |C7_roll - T7_roll|  (좌우 비대칭 정도)
    "pitch_range",          # C7_pitch - T7_pitch  (전체 척추 기울기 범위)
    "roll_magnitude",       # sqrt(C7r²+T3r²+T7r²) (전체 roll 크기)
]

# 모델 학습 / 추론용 (raw + 파생)
FEATURE_COLS = RAW_FEATURE_COLS + DERIVED_FEATURE_COLS


def build_features(dp: list[float], dr: list[float]) -> list[float]:
    """
    raw diff 값으로 전체 feature 벡터(11개)를 생성합니다.

    dp = [C7_pitch_diff, T3_pitch_diff, T7_pitch_diff]
    dr = [C7_roll_diff,  T3_roll_diff,  T7_roll_diff]
    """
    raw = [v for pair in zip(dp, dr) for v in pair]

    neck_flexion_diff   = dp[0] - dp[1]
    thoracic_curve_diff = dp[1] - dp[2]
    lateral_asymmetry   = abs(dr[0] - dr[2])
    pitch_range         = dp[0] - dp[2]
    roll_magnitude      = math.sqrt(dr[0]**2 + dr[1]**2 + dr[2]**2)

    derived = [
        neck_flexion_diff,
        thoracic_curve_diff,
        lateral_asymmetry,
        pitch_range,
        roll_magnitude,
    ]
    return raw + derived


def raw_from_features(features: list[float]) -> list[float]:
    """full feature 벡터에서 raw 6개만 꺼냅니다 (Firestore 저장용)."""
    return features[:len(RAW_FEATURE_COLS)]


def features_from_raw(raw: list[float]) -> list[float]:
    """
    Firestore에 저장된 raw 6개로 full feature 벡터를 복원합니다.
    raw = [C7p, C7r, T3p, T3r, T7p, T7r]  (RAW_FEATURE_COLS 순서)
    """
    dp = [raw[0], raw[2], raw[4]]   # C7_pitch, T3_pitch, T7_pitch
    dr = [raw[1], raw[3], raw[5]]   # C7_roll,  T3_roll,  T7_roll
    return build_features(dp, dr)
