"""
자동 재학습 모듈.

Firestore training_samples 컬렉션에서 샘플을 읽어
RandomForest를 재학습하고 메모리에서 핫 리로드합니다.
재배포 없이 모델이 교체됩니다.
"""

import asyncio
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from posture_engine import ml

BASE_DIR    = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(BASE_DIR, "models", "posture_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler.pkl")

SENSORS      = ["C7", "T3", "T7"]
FEATURE_COLS = [f"diff_{s}_{ax}" for s in SENSORS for ax in ("pitch", "roll")]
MIN_SAMPLES_PER_CLASS = 5


def _train_sync(rows: list[dict]) -> dict:
    """동기 학습 함수 — asyncio.to_thread로 호출합니다."""
    df = pd.DataFrame(rows)

    counts = df["label"].value_counts()
    valid  = counts[counts >= MIN_SAMPLES_PER_CLASS].index.tolist()
    df     = df[df["label"].isin(valid)]

    if len(valid) < 2:
        raise ValueError(f"학습 가능한 클래스가 부족합니다 (현재: {valid}). 자세당 최소 {MIN_SAMPLES_PER_CLASS}샘플 필요")

    X = df[FEATURE_COLS].values
    y = df["label"].values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_tr_s, y_tr)

    train_acc = model.score(X_tr_s, y_tr)
    test_acc  = model.score(X_te_s, y_te)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    return {
        "classes":       list(model.classes_),
        "total_samples": len(df),
        "train_acc":     round(train_acc * 100, 1),
        "test_acc":      round(test_acc  * 100, 1),
        "label_counts":  counts.to_dict(),
    }


async def retrain(rows: list[dict]) -> dict:
    """
    rows: [{ "diff_C7_pitch": float, ..., "label": str }, ...]
    학습 완료 후 ml.model / ml.scaler 핫 리로드.
    """
    result = await asyncio.to_thread(_train_sync, rows)

    # 핫 리로드 — 진행 중인 추론 요청과 race 없음 (GIL 하에서 dict assign은 원자적)
    ml.model  = joblib.load(MODEL_PATH)
    ml.scaler = joblib.load(SCALER_PATH)
    ml.is_ready = True

    print(f"✅ 모델 재학습 완료: {result['total_samples']}샘플 "
          f"/ 테스트 정확도 {result['test_acc']}%")
    return result
