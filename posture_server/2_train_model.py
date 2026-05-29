"""
[Part 2] AI 모델 학습

센서: C7 / T3 / T7 × pitch / roll = 6피처
레이블: normal / forward_head / kyphosis / lateral_tilt

실행: python 2_train_model.py
      python 2_train_model.py --csv-path data/training_data_augmented.csv \
                               --model-dir models/candidate_augmented \
                               --dry-run
"""

import argparse
import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (classification_report, confusion_matrix,
                             recall_score, precision_recall_fscore_support)

from features import SENSORS, RAW_FEATURE_COLS, FEATURE_COLS, features_from_raw

BASE_DIR         = os.path.dirname(__file__)
DEFAULT_CSV_PATH = os.path.join(BASE_DIR, "data",   "training_data.csv")
DEFAULT_MDL_DIR  = os.path.join(BASE_DIR, "models", "default")

LABEL_COL   = "label"
POSE_LABELS = ["normal", "forward_head", "kyphosis", "lateral_tilt"]
BAD_CLASSES = ["forward_head", "kyphosis", "lateral_tilt"]


def parse_args():
    p = argparse.ArgumentParser(description="C7AI 자세 분류 모델 학습")
    p.add_argument("--csv-path",  default=DEFAULT_CSV_PATH,
                   help="학습 CSV 경로 (default: data/training_data.csv)")
    p.add_argument("--model-dir", default=DEFAULT_MDL_DIR,
                   help="모델 저장 디렉토리 (default: models/default)")
    p.add_argument("--dry-run",   action="store_true",
                   help="평가만 실행, 모델 파일 저장 안 함")
    p.add_argument("--real-csv",  default=DEFAULT_CSV_PATH,
                   help="비교 기준용 original CSV (default: data/training_data.csv)")
    return p.parse_args()


def load_data(csv_path: str):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"데이터 없음: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"데이터: {len(df)}행  raw 피처: {len(RAW_FEATURE_COLS)}개 → 파생 포함: {len(FEATURE_COLS)}개")
    print(df[LABEL_COL].value_counts().to_string() + "\n")

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


def evaluate(model, scaler, X_train, y_train, X_test, y_test,
             section_label: str = "") -> dict:
    if section_label:
        print(f"\n{'='*50}\n {section_label}\n{'='*50}")

    y_pred = model.predict(X_test)

    # ── 기본 정확도 ───────────────────────────────────────
    train_acc = model.score(X_train, y_train) * 100
    test_acc  = model.score(X_test,  y_test)  * 100
    print(f"훈련 정확도 : {train_acc:.1f}%")
    print(f"테스트 정확도: {test_acc:.1f}%\n")

    # ── 클래스별 상세 리포트 ──────────────────────────────
    present = [l for l in POSE_LABELS if l in np.unique(y_test)]
    cr_text = classification_report(y_test, y_pred, labels=present,
                                    target_names=present, zero_division=0)
    print(cr_text)

    # ── per-label precision/recall/f1 dict ───────────────
    prec, rec, f1, sup = precision_recall_fscore_support(
        y_test, y_pred, labels=present, zero_division=0)
    per_label = {
        lbl: {"precision": float(prec[i]), "recall": float(rec[i]),
              "f1": float(f1[i]), "support": int(sup[i])}
        for i, lbl in enumerate(present)
    }

    # ── 위험 자세 Miss Rate (핵심 지표) ──────────────────
    print("[위험 자세 Miss Rate]  — 낮을수록 좋음 (실제 나쁜 자세를 '정상'으로 놓친 비율)")
    miss_rates = {}
    any_miss = False
    for cls in BAD_CLASSES:
        if cls not in np.unique(y_test):
            continue
        missed    = int(np.sum((y_test == cls) & (y_pred != cls)))
        total     = int(np.sum(y_test == cls))
        miss_rate = missed / total * 100
        miss_rates[cls] = {"missed": missed, "total": total, "miss_rate_pct": round(miss_rate, 2)}
        flag = " ⚠️" if miss_rate > 15 else ""
        print(f"  {cls:<16} {missed:>3}/{total}  miss={miss_rate:.1f}%{flag}")
        if miss_rate > 15:
            any_miss = True
    if any_miss:
        print("  → miss rate 15% 초과 클래스 있음. 해당 클래스 데이터 보강 권장")
    print()

    # ── normal 과검출 (False Positive) ───────────────────
    normal_mask  = y_test == "normal"
    normal_fp    = int(np.sum(normal_mask & (y_pred != "normal")))
    normal_total = int(np.sum(normal_mask))
    normal_fpr   = normal_fp / normal_total * 100 if normal_total > 0 else 0
    flag = " ⚠️" if normal_fpr > 10 else ""
    print(f"[normal 과검출]  정상인데 나쁜 자세로 분류: {normal_fp}/{normal_total}  ({normal_fpr:.1f}%){flag}")
    if normal_fpr > 10:
        print("  → 알림 피로 위험. normal 데이터 보강 또는 threshold 조정 권장")
    print()

    # ── 위험 자세 평균 Recall ─────────────────────────────
    bad_present = [c for c in BAD_CLASSES if c in np.unique(y_test)]
    bad_recall = 0.0
    if bad_present:
        bad_recall = recall_score(y_test, y_pred, labels=bad_present,
                                  average="macro", zero_division=0) * 100
        flag = " ⚠️" if bad_recall < 85 else ""
        print(f"[위험 자세 평균 Recall]  {bad_recall:.1f}%  (목표: ≥ 85%){flag}")
        print()

    # ── 혼동행렬 ─────────────────────────────────────────
    cm    = confusion_matrix(y_test, y_pred, labels=present)
    col_w = 14
    short = [l[:12] for l in present]
    print("[혼동행렬]  (행=실제, 열=예측)")
    print(" " * 14 + "".join(f"{l:>{col_w}}" for l in short))
    for i, row_label in enumerate(short):
        row = "".join(f"{cm[i][j]:>{col_w}}" for j in range(len(present)))
        print(f"{row_label:>14}{row}")
    print()

    # ── 센서별 feature 중요도 ────────────────────────────
    print("[센서별 축 중요도]")
    importances = {}
    for s in SENSORS:
        for ax in ("pitch", "roll"):
            key = f"diff_{s}_{ax}"
            if key in FEATURE_COLS:
                imp = float(model.feature_importances_[FEATURE_COLS.index(key)])
                importances[key] = imp
                bar = "█" * int(imp * 40)
                print(f"  {s} {ax:5}: {bar} {imp*100:.1f}%")
    print()

    # ── 5-fold CV ────────────────────────────────────────
    X_all = np.vstack([X_train, X_test])
    y_all = np.concatenate([y_train, y_test])
    cv    = cross_val_score(model, scaler.transform(X_all), y_all, cv=5)
    cv_mean = float(cv.mean() * 100)
    cv_std  = float(cv.std()  * 100)
    flag  = " ⚠️" if cv_std > 3 else ""
    print(f"[5-fold CV]  {cv_mean:.1f}% ± {cv_std:.1f}%{flag}")
    if cv_std > 3:
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
    print(f"  CV 분산           : ±{cv_std:.1f}%  (목표 ≤ 3%)")

    issues = []
    if test_acc < 85:
        issues.append("전체 정확도 낮음")
    if bad_present and bad_recall < 85:
        issues.append("위험 자세 recall 부족")
    if normal_fpr > 10:
        issues.append("normal 과검출 높음")
    if cv_std > 3:
        issues.append("CV 분산 큼")

    print()
    if issues:
        print(f"  ⚠️  개선 필요: {', '.join(issues)}")
    else:
        print("  ✅ 모든 지표 목표 달성")

    return {
        "train_accuracy_pct":   round(train_acc, 2),
        "test_accuracy_pct":    round(test_acc, 2),
        "bad_posture_recall_pct": round(bad_recall, 2),
        "normal_false_positive_pct": round(normal_fpr, 2),
        "cv_mean_pct":  round(cv_mean, 2),
        "cv_std_pct":   round(cv_std, 2),
        "per_label":    per_label,
        "miss_rates":   miss_rates,
        "normal_fp":    normal_fp,
        "normal_total": normal_total,
        "feature_importances": importances,
        "issues":       issues,
        "confusion_matrix": {
            "labels": present,
            "matrix": cm.tolist(),
        },
    }


def save_artifacts(metrics: dict, model_dir: str, cm_extra: dict | None = None) -> None:
    """evaluation_report.json + confusion_matrix.csv 저장."""
    import csv as csv_mod

    report_path = os.path.join(model_dir, "evaluation_report.json")
    cm_path     = os.path.join(model_dir, "confusion_matrix.csv")

    with open(report_path, "w") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
    print(f"[saved] {report_path}")

    # confusion matrix CSV (primary from metrics)
    cm_data = metrics.get("confusion_matrix", cm_extra)
    if cm_data:
        labels = cm_data["labels"]
        matrix = cm_data["matrix"]
        with open(cm_path, "w", newline="") as f:
            writer = csv_mod.writer(f)
            writer.writerow(["actual\\predicted"] + labels)
            for lbl, row in zip(labels, matrix):
                writer.writerow([lbl] + row)
        print(f"[saved] {cm_path}")


def load_default_model() -> tuple | None:
    """기존 default 모델 로드. 없으면 None 반환."""
    mdl_path = os.path.join(BASE_DIR, "models", "default", "posture_model.pkl")
    scl_path = os.path.join(BASE_DIR, "models", "default", "scaler.pkl")
    if os.path.exists(mdl_path) and os.path.exists(scl_path):
        return joblib.load(mdl_path), joblib.load(scl_path)
    return None


def main():
    args = parse_args()

    print("\n" + "="*50)
    print(" AI 자세 분류 모델 학습 (C7/T3/T7, 4클래스)")
    if args.csv_path != DEFAULT_CSV_PATH:
        print(f" CSV: {args.csv_path}")
    if args.model_dir != DEFAULT_MDL_DIR:
        print(f" 출력: {args.model_dir}")
    if args.dry_run:
        print(" [DRY-RUN] 모델 파일 저장 안 함")
    print("="*50)

    # ── 데이터 로드 ───────────────────────────────────────
    X, y = load_data(args.csv_path)

    # ── 학습 분할: 전체 CSV 80/20 ────────────────────────
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

    scaler  = StandardScaler()
    X_tr_s  = scaler.fit_transform(X_tr)
    X_te_s  = scaler.transform(X_te)

    print("학습 중...")
    model = train(X_tr_s, y_tr)
    print("완료\n")

    # ── 1차 평가: 학습 CSV 20% held-out ──────────────────
    metrics = evaluate(model, scaler, X_tr_s, y_tr, X_te_s, y_te,
                       section_label="평가 A — 학습 CSV 20% held-out")

    # ── 2차 평가: original real CSV 20% held-out ─────────
    real_metrics = None
    if args.real_csv != args.csv_path and os.path.exists(args.real_csv):
        print(f"\n[비교] original CSV 로드: {args.real_csv}")
        X_real, y_real = load_data(args.real_csv)
        _, X_real_te, _, y_real_te = train_test_split(
            X_real, y_real, test_size=0.2, stratify=y_real, random_state=42)
        X_real_te_s = scaler.transform(X_real_te)
        real_metrics = evaluate(model, scaler, X_tr_s, y_tr, X_real_te_s, y_real_te,
                                section_label="평가 B — original CSV 20% held-out (실제 분포)")

    # ── 3차 평가: default 모델 vs candidate (같은 real held-out) ──
    default_result = load_default_model()
    default_metrics = None
    if default_result and real_metrics is not None:
        def_model, def_scaler = default_result
        print("\n[비교] default 모델 vs candidate — original CSV 20% held-out")
        _, X_real_te2, _, y_real_te2 = train_test_split(
            X_real, y_real, test_size=0.2, stratify=y_real, random_state=42)
        X_def_te_s = def_scaler.transform(X_real_te2)
        default_metrics = evaluate(def_model, def_scaler, X_tr_s, y_tr, X_def_te_s, y_real_te2,
                                   section_label="평가 C — default 모델 (비교 기준)")

        # ── delta summary ──────────────────────────────────
        print("\n" + "="*50)
        print(" Delta 요약  (candidate_augmented − default)")
        print("="*50)
        def delta(key, fmt="+.2f"):
            c = real_metrics.get(key, 0)
            d = default_metrics.get(key, 0)
            sign = "+" if c >= d else ""
            arrow = "▲" if c > d else ("▼" if c < d else "=")
            return f"{arrow} {sign}{c-d:{fmt[1:]}}  (candidate={c:.2f}, default={d:.2f})"
        print(f"  test_accuracy        : {delta('test_accuracy_pct')}")
        print(f"  bad_posture_recall   : {delta('bad_posture_recall_pct')}")
        print(f"  normal_false_positive: {delta('normal_false_positive_pct')}")
        print(f"  cv_std               : {delta('cv_std_pct')}")
        print()

    # ── 아티팩트 저장 (dry-run 포함) ──────────────────────
    full_report = {
        "model": "candidate_augmented" if args.model_dir != DEFAULT_MDL_DIR else "default",
        "csv_path": args.csv_path,
        "dry_run": args.dry_run,
        "eval_a_mixed_holdout": metrics,
        "eval_b_real_holdout":  real_metrics,
        "eval_c_default_model": default_metrics,
    }

    if args.model_dir != DEFAULT_MDL_DIR or not args.dry_run:
        os.makedirs(args.model_dir, exist_ok=True)
        save_artifacts(full_report, args.model_dir)

    # ── 모델 파일 저장 ────────────────────────────────────
    model_path  = os.path.join(args.model_dir, "posture_model.pkl")
    scaler_path = os.path.join(args.model_dir, "scaler.pkl")

    if args.dry_run:
        print(f"\n[DRY-RUN] 저장 생략 → {model_path}")
    else:
        os.makedirs(args.model_dir, exist_ok=True)
        joblib.dump(model,  model_path)
        joblib.dump(scaler, scaler_path)
        print(f"\n저장 완료: {model_path}")
        if args.model_dir == DEFAULT_MDL_DIR:
            print("다음 단계: python 3_server.py")
        else:
            print("다음 단계: auto_trainer.py로 A/B 프로모션 검토")


if __name__ == "__main__":
    main()
