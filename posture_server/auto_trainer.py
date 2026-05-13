"""
자동 재학습 모듈.

재학습 흐름:
  1. fetch_training_samples로 학습셋 구성
  2. candidate 모델 학습
  3. default 모델 / 현재 current 모델과 A/B 비교
  4. 승격 기준 통과 시에만 current로 저장 + 핫 리로드
  5. 실패 시 models/rejected/에 보관, 현재 모델 유지
"""

import asyncio
import os
import shutil
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, recall_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from posture_engine import ml
from features import RAW_FEATURE_COLS, FEATURE_COLS, features_from_raw

BASE_DIR      = os.path.dirname(__file__)
CURRENT_MODEL_PATH  = os.path.join(BASE_DIR, "models", "current",  "posture_model.pkl")
CURRENT_SCALER_PATH = os.path.join(BASE_DIR, "models", "current",  "scaler.pkl")
DEFAULT_MODEL_PATH  = os.path.join(BASE_DIR, "models", "default",  "posture_model.pkl")
DEFAULT_SCALER_PATH = os.path.join(BASE_DIR, "models", "default",  "scaler.pkl")
REJECTED_DIR        = os.path.join(BASE_DIR, "models", "rejected")
CSV_PATH            = os.path.join(BASE_DIR, "data",   "training_data.csv")

BAD_CLASSES = ["forward_head", "kyphosis", "lateral_tilt"]

MIN_SAMPLES_PER_CLASS = 5

# 승격 기준
PROMOTE_MIN_ACC_DELTA       = -2.0   # default 대비 test_acc 허용 하락 (%)
PROMOTE_MIN_RECALL_DELTA    = -5.0   # 위험 자세 recall 허용 하락 (%)
PROMOTE_MAX_CLASS_IMBALANCE =  5.0   # 클래스 간 최대 샘플 비율


def _build_model() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )


def _bad_recall(model, scaler, X, y) -> float:
    """위험 자세 3개의 평균 recall."""
    present = [c for c in BAD_CLASSES if c in np.unique(y)]
    if not present:
        return 0.0
    X_s  = scaler.transform(X)
    y_pred = model.predict(X_s)
    return float(recall_score(y, y_pred, labels=present, average="macro", zero_division=0))


def _check_class_balance(y) -> bool:
    """클래스 간 샘플 수 비율이 MAX 이내인지 확인."""
    counts = pd.Series(y).value_counts()
    if len(counts) < 2:
        return False
    ratio = counts.max() / counts.min()
    return ratio <= PROMOTE_MAX_CLASS_IMBALANCE


def _load_default() -> tuple | None:
    """default 모델 로드. 없으면 None."""
    if os.path.exists(DEFAULT_MODEL_PATH) and os.path.exists(DEFAULT_SCALER_PATH):
        return joblib.load(DEFAULT_MODEL_PATH), joblib.load(DEFAULT_SCALER_PATH)
    return None


def _load_current() -> tuple | None:
    """current 모델 로드. 없으면 None."""
    if os.path.exists(CURRENT_MODEL_PATH) and os.path.exists(CURRENT_SCALER_PATH):
        return joblib.load(CURRENT_MODEL_PATH), joblib.load(CURRENT_SCALER_PATH)
    return None


def _evaluate_against_baseline(
    baseline_name: str,
    baseline_pair: tuple | None,
    candidate,
    scaler,
    X_te,
    y_te,
) -> tuple[bool, dict]:
    """
    candidate를 baseline(default/current)과 비교합니다.

    반환:
      (통과 여부, 비교 정보 dict)
    """
    cand_acc = candidate.score(scaler.transform(X_te), y_te) * 100
    cand_recall = _bad_recall(candidate, scaler, X_te, y_te) * 100

    if baseline_pair is None:
        return True, {
            "baseline": baseline_name,
            "missing": True,
            "candidate_acc": cand_acc,
            "candidate_recall": cand_recall,
            "baseline_acc": None,
            "baseline_recall": None,
            "acc_delta": None,
            "recall_delta": None,
            "passed": True,
            "reason": "",
        }

    base_model, base_scaler = baseline_pair
    base_acc = base_model.score(base_scaler.transform(X_te), y_te) * 100
    base_recall = _bad_recall(base_model, base_scaler, X_te, y_te) * 100

    acc_delta = cand_acc - base_acc
    recall_delta = cand_recall - base_recall

    if acc_delta < PROMOTE_MIN_ACC_DELTA:
        return False, {
            "baseline": baseline_name,
            "missing": False,
            "candidate_acc": cand_acc,
            "candidate_recall": cand_recall,
            "baseline_acc": base_acc,
            "baseline_recall": base_recall,
            "acc_delta": acc_delta,
            "recall_delta": recall_delta,
            "passed": False,
            "reason": f"{baseline_name} 대비 acc 하락 {acc_delta:+.1f}% (허용: {PROMOTE_MIN_ACC_DELTA}%)",
        }

    if recall_delta < PROMOTE_MIN_RECALL_DELTA:
        return False, {
            "baseline": baseline_name,
            "missing": False,
            "candidate_acc": cand_acc,
            "candidate_recall": cand_recall,
            "baseline_acc": base_acc,
            "baseline_recall": base_recall,
            "acc_delta": acc_delta,
            "recall_delta": recall_delta,
            "passed": False,
            "reason": f"{baseline_name} 대비 recall 하락 {recall_delta:+.1f}% (허용: {PROMOTE_MIN_RECALL_DELTA}%)",
        }

    return True, {
        "baseline": baseline_name,
        "missing": False,
        "candidate_acc": cand_acc,
        "candidate_recall": cand_recall,
        "baseline_acc": base_acc,
        "baseline_recall": base_recall,
        "acc_delta": acc_delta,
        "recall_delta": recall_delta,
        "passed": True,
        "reason": "",
    }


def _save_rejected(model, scaler) -> None:
    """승격 실패 모델을 rejected/ 에 타임스탬프와 함께 보관."""
    os.makedirs(REJECTED_DIR, exist_ok=True)
    ts = int(time.time())
    joblib.dump(model,  os.path.join(REJECTED_DIR, f"posture_model_{ts}.pkl"))
    joblib.dump(scaler, os.path.join(REJECTED_DIR, f"scaler_{ts}.pkl"))


def _load_csv_rows() -> list[dict]:
    """default CSV를 dict 리스트로 로드합니다."""
    if not os.path.exists(CSV_PATH):
        print(f"⚠️  CSV 없음 ({CSV_PATH}) — Firestore 데이터만 사용")
        return []
    df = pd.read_csv(CSV_PATH)
    # CSV 컬럼이 RAW_FEATURE_COLS 순서와 다를 수 있으므로 컬럼명 기준으로 선택
    available = [c for c in RAW_FEATURE_COLS if c in df.columns]
    if len(available) < len(RAW_FEATURE_COLS) or "label" not in df.columns:
        print("⚠️  CSV 컬럼 불일치 — CSV 제외")
        return []
    rows = df[available + ["label"]].to_dict(orient="records")
    print(f"📂 CSV 로드: {len(rows)}행")
    return rows


def _train_sync(rows: list[dict]) -> dict:
    """동기 학습 + A/B 비교 + 조건부 승격."""
    # CSV(default 기준점) + Firestore(guided/auto) 합치기
    csv_rows = _load_csv_rows()
    all_rows = csv_rows + rows
    print(f"📊 학습셋: CSV {len(csv_rows)}개 + Firestore {len(rows)}개 = 총 {len(all_rows)}개")

    df = pd.DataFrame(all_rows)

    # 유효 클래스 필터
    counts = df["label"].value_counts()
    valid  = counts[counts >= MIN_SAMPLES_PER_CLASS].index.tolist()
    df     = df[df["label"].isin(valid)]

    if len(valid) < 2:
        raise ValueError(f"학습 가능한 클래스 부족 ({valid}). 자세당 최소 {MIN_SAMPLES_PER_CLASS}샘플 필요")

    if not _check_class_balance(df["label"].values):
        raise ValueError(f"클래스 불균형 {PROMOTE_MAX_CLASS_IMBALANCE}:1 초과 — 데이터 보강 필요")

    # raw 6개 → 파생 포함 11개로 확장
    raw_matrix = df[RAW_FEATURE_COLS].values
    X = np.array([features_from_raw(row.tolist()) for row in raw_matrix])
    y = df["label"].values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)

    candidate = _build_model()
    candidate.fit(X_tr_s, y_tr)

    cand_acc    = candidate.score(scaler.transform(X_te), y_te) * 100
    cand_recall = _bad_recall(candidate, scaler, X_te, y_te) * 100

    # ── default / current 둘 다 비교 ─────────────────────
    default_pair = _load_default()
    current_pair = _load_current()
    promoted = False
    reject_reason = ""

    checks = []
    for baseline_name, pair in (("default", default_pair), ("current", current_pair)):
        ok, info = _evaluate_against_baseline(
            baseline_name,
            pair,
            candidate,
            scaler,
            X_te,
            y_te,
        )
        checks.append(info)

        print(f"📊 비교 | candidate acc={cand_acc:.1f}% recall={cand_recall:.1f}%")
        if info["missing"]:
            print(f"        | {baseline_name:<10} 없음 — 비교 생략")
        else:
            print(
                f"        | {baseline_name:<10} acc={info['baseline_acc']:.1f}%   "
                f"recall={info['baseline_recall']:.1f}%"
            )
            print(
                f"        | delta      acc={info['acc_delta']:+.1f}%  "
                f"recall={info['recall_delta']:+.1f}%"
            )

        if not ok and not reject_reason:
            reject_reason = info["reason"]

    if all(info["passed"] for info in checks):
        promoted = True
    elif not reject_reason:
        reject_reason = "baseline 비교 조건 미통과"

    if promoted:
        os.makedirs(os.path.dirname(CURRENT_MODEL_PATH), exist_ok=True)
        joblib.dump(candidate, CURRENT_MODEL_PATH)
        joblib.dump(scaler,    CURRENT_SCALER_PATH)
        print(f"✅ 승격 완료: acc={cand_acc:.1f}% recall={cand_recall:.1f}%")
    else:
        _save_rejected(candidate, scaler)
        print(f"❌ 승격 거부: {reject_reason}")

    return {
        "classes":        list(candidate.classes_),
        "total_samples":  len(df),
        "label_counts":   counts.to_dict(),
        "train_acc":      round(candidate.score(X_tr_s, y_tr) * 100, 1),
        "test_acc":       round(cand_acc, 1),
        "bad_recall":     round(cand_recall, 1),
        "promoted":       promoted,
        "reject_reason":  reject_reason,
        "baseline_checks": checks,
    }


async def retrain(rows: list[dict]) -> dict:
    """
    rows: [{ "diff_C7_pitch": float, ..., "label": str }, ...]
    승격 성공 시 ml.model / ml.scaler 핫 리로드.
    """
    result = await asyncio.to_thread(_train_sync, rows)

    if result["promoted"]:
        ml.model    = joblib.load(CURRENT_MODEL_PATH)
        ml.scaler   = joblib.load(CURRENT_SCALER_PATH)
        ml.is_ready = True
        print(f"🔄 핫 리로드 완료: {result['total_samples']}샘플 / 정확도 {result['test_acc']}%")
    else:
        print(f"⚠️  핫 리로드 건너뜀 (승격 거부): {result['reject_reason']}")

    return result
