"""
[Part 2] AI 모델 학습

센서: C7 / T7 / T3 × pitch / roll = 6피처
레이블: normal / forward_head / kyphosis / text_neck / lean_back / lateral_tilt

실행: python 2_train_model.py
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix

BASE_DIR    = os.path.dirname(__file__)
CSV_PATH    = os.path.join(BASE_DIR, "data",   "training_data.csv")
MODEL_PATH  = os.path.join(BASE_DIR, "models", "posture_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler.pkl")

SENSORS      = ["C7", "T3", "T7"]
FEATURE_COLS = [f"diff_{s}_{ax}" for s in SENSORS for ax in ("pitch", "roll")]
LABEL_COL    = "label"
POSE_LABELS  = ["normal", "forward_head", "kyphosis", "lateral_tilt"]


def load_data():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"데이터 없음: {CSV_PATH}\npython 1_collect_data.py --simulate 먼저 실행")
    df = pd.read_csv(CSV_PATH)
    print(f"데이터: {len(df)}행  피처: {len(FEATURE_COLS)}개")
    print(df[LABEL_COL].value_counts().to_string() + "\n")
    return df[FEATURE_COLS].values, df[LABEL_COL].values


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


def evaluate(model, scaler, X_train, y_train, X_test, y_test):
    print(f"훈련 정확도 : {model.score(X_train, y_train)*100:.1f}%")
    print(f"테스트 정확도: {model.score(X_test,  y_test)*100:.1f}%\n")

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=POSE_LABELS, zero_division=0))

    print("[센서별 축 중요도]")
    for s in SENSORS:
        pi = model.feature_importances_[FEATURE_COLS.index(f"diff_{s}_pitch")]
        ri = model.feature_importances_[FEATURE_COLS.index(f"diff_{s}_roll")]
        print(f"  {s} pitch: {'█'*int(pi*40)} {pi*100:.1f}%")
        print(f"  {s} roll : {'█'*int(ri*40)} {ri*100:.1f}%")

    X_all = np.vstack([X_train, X_test])
    y_all = np.concatenate([y_train, y_test])
    cv = cross_val_score(model, scaler.transform(X_all), y_all, cv=5)
    print(f"\n5-fold CV: {cv.mean()*100:.1f}% ± {cv.std()*100:.1f}%")


def main():
    print("\n" + "="*50)
    print(" AI 자세 분류 모델 학습 (C7/T7/T3, 6클래스)")
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
