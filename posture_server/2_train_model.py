"""
[Part 2] AI 모델 학습

센서: C7 / T3 / T7 × pitch / roll = 6피처
레이블: normal / forward_head / kyphosis / lateral_tilt

실행: python 2_train_model.py
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, recall_score

from features import SENSORS, RAW_FEATURE_COLS, FEATURE_COLS, features_from_raw

BASE_DIR    = os.path.dirname(__file__)
CSV_PATH    = os.path.join(BASE_DIR, "data",   "training_data.csv")
MODEL_PATH  = os.path.join(BASE_DIR, "models", "default", "posture_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "default", "scaler.pkl")

LABEL_COL   = "label"
POSE_LABELS = ["normal", "forward_head", "kyphosis", "lateral_tilt"]


def load_data():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"데이터 없음: {CSV_PATH}\npython 1_collect_data.py --simulate 먼저 실행")
    df = pd.read_csv(CSV_PATH)
    print(f"데이터: {len(df)}행  raw 피처: {len(RAW_FEATURE_COLS)}개 → 파생 포함: {len(FEATURE_COLS)}개")
    print(df[LABEL_COL].value_counts().to_string() + "\n")

    # raw 6개에서 파생 feature 추가해 11개로 확장
    raw_matrix = df[RAW_FEATURE_COLS].values
    X = np.array([features_from_raw(row.tolist()) for row in raw_matrix])
    y = df[LABEL_COL].values
    return X, y


def train(X_train, y_train):
    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


BAD_CLASSES = ["forward_head", "kyphosis", "lateral_tilt"]


def evaluate(model, scaler, X_train, y_train, X_test, y_test):
    y_pred = model.predict(X_test)

    # ── 기본 정확도 ───────────────────────────────────────
    train_acc = model.score(X_train, y_train) * 100
    test_acc  = model.score(X_test,  y_test)  * 100
    print(f"훈련 정확도 : {train_acc:.1f}%")
    print(f"테스트 정확도: {test_acc:.1f}%\n")

    # ── 클래스별 상세 리포트 ──────────────────────────────
    present = [l for l in POSE_LABELS if l in np.unique(y_test)]
    print(classification_report(y_test, y_pred, labels=present, target_names=present, zero_division=0))

    # ── 위험 자세 Miss Rate (핵심 지표) ──────────────────
    print("[위험 자세 Miss Rate]  — 낮을수록 좋음 (실제 나쁜 자세를 '정상'으로 놓친 비율)")
    any_miss = False
    for cls in BAD_CLASSES:
        if cls not in np.unique(y_test):
            continue
        mask     = y_test == cls
        missed   = np.sum((y_test == cls) & (y_pred != cls))
        total    = np.sum(mask)
        miss_rate = missed / total * 100
        flag      = " ⚠️" if miss_rate > 15 else ""
        print(f"  {cls:<16} {missed:>3}/{total}  miss={miss_rate:.1f}%{flag}")
        if miss_rate > 15:
            any_miss = True
    if any_miss:
        print("  → miss rate 15% 초과 클래스 있음. 해당 클래스 데이터 보강 권장")
    print()

    # ── normal 과검출 (False Positive) ───────────────────
    normal_mask  = y_test == "normal"
    normal_fp    = np.sum(normal_mask & (y_pred != "normal"))
    normal_total = np.sum(normal_mask)
    normal_fpr   = normal_fp / normal_total * 100 if normal_total > 0 else 0
    flag = " ⚠️" if normal_fpr > 10 else ""
    print(f"[normal 과검출]  정상인데 나쁜 자세로 분류: {normal_fp}/{normal_total}  ({normal_fpr:.1f}%){flag}")
    if normal_fpr > 10:
        print("  → 알림 피로 위험. normal 데이터 보강 또는 threshold 조정 권장")
    print()

    # ── 위험 자세 평균 Recall ─────────────────────────────
    bad_present = [c for c in BAD_CLASSES if c in np.unique(y_test)]
    if bad_present:
        bad_recall = recall_score(y_test, y_pred, labels=bad_present, average="macro", zero_division=0) * 100
        flag = " ⚠️" if bad_recall < 85 else ""
        print(f"[위험 자세 평균 Recall]  {bad_recall:.1f}%  (목표: ≥ 85%){flag}")
        print()

    # ── 혼동행렬 ─────────────────────────────────────────
    cm     = confusion_matrix(y_test, y_pred, labels=present)
    col_w  = 14
    short  = [l[:12] for l in present]
    print("[혼동행렬]  (행=실제, 열=예측)")
    print(" " * 14 + "".join(f"{l:>{col_w}}" for l in short))
    for i, row_label in enumerate(short):
        row = "".join(f"{cm[i][j]:>{col_w}}" for j in range(len(present)))
        print(f"{row_label:>14}{row}")
    print()

    # ── 센서별 feature 중요도 ────────────────────────────
    print("[센서별 축 중요도]")
    for s in SENSORS:
        pitch_key = f"diff_{s}_pitch"
        roll_key  = f"diff_{s}_roll"
        if pitch_key in FEATURE_COLS and roll_key in FEATURE_COLS:
            pi = model.feature_importances_[FEATURE_COLS.index(pitch_key)]
            ri = model.feature_importances_[FEATURE_COLS.index(roll_key)]
            print(f"  {s} pitch: {'█'*int(pi*40)} {pi*100:.1f}%")
            print(f"  {s} roll : {'█'*int(ri*40)} {ri*100:.1f}%")
    print()

    # ── 5-fold CV ────────────────────────────────────────
    X_all = np.vstack([X_train, X_test])
    y_all = np.concatenate([y_train, y_test])
    cv    = cross_val_score(model, scaler.transform(X_all), y_all, cv=5)
    flag  = " ⚠️" if cv.std() * 100 > 3 else ""
    print(f"[5-fold CV]  {cv.mean()*100:.1f}% ± {cv.std()*100:.1f}%{flag}")
    if cv.std() * 100 > 3:
        print("  → 분산이 큼. 데이터 편향 또는 샘플 수 부족 가능성")
    print()

    # ── 최종 요약 ────────────────────────────────────────
    print("=" * 50)
    print(" 평가 요약")
    print("=" * 50)
    print(f"  테스트 정확도     : {test_acc:.1f}%")
    if bad_present:
        print(f"  위험 자세 recall  : {bad_recall:.1f}%  (목표 ≥ 85%)")
    print(f"  normal 과검출     : {normal_fpr:.1f}%  (목표 ≤ 10%)")
    print(f"  CV 분산           : ±{cv.std()*100:.1f}%  (목표 ≤ 3%)")

    issues = []
    if test_acc < 85:
        issues.append("전체 정확도 낮음")
    if bad_present and bad_recall < 85:
        issues.append("위험 자세 recall 부족")
    if normal_fpr > 10:
        issues.append("normal 과검출 높음")
    if cv.std() * 100 > 3:
        issues.append("CV 분산 큼")

    print()
    if issues:
        print(f"  ⚠️  개선 필요: {', '.join(issues)}")
    else:
        print("  ✅ 모든 지표 목표 달성")


def main():
    print("\n" + "="*50)
    print(" AI 자세 분류 모델 학습 (C7/T3/T7, 4클래스)")
    print("="*50)

    X, y = load_data()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    print("학습 중...")
    model = train(X_tr_s, y_tr)
    print("완료\n")

    evaluate(model, scaler, X_tr_s, y_tr, X_te_s, y_te)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model,  MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\n저장 완료: {MODEL_PATH}")
    print("다음 단계: python 3_server.py")


if __name__ == "__main__":
    main()
