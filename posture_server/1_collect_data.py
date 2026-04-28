"""
[Part 1] 자세 데이터 수집 스크립트

센서: C7 / T7 / T3  (3개, pitch + roll = 6피처)
영점: 벽에 등 붙이고 서서 측정 → 개인 baseline 저장

부호 규칙:
    pitch 양수 = 앞으로 기울어짐
    roll  양수 = 오른쪽 기울어짐

실행: python 1_collect_data.py --simulate
"""

import argparse
import csv
import os
import time
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(DATA_DIR, "training_data.csv")

SENSORS      = ["C7", "T7", "T3"]
FEATURE_COLS = [f"diff_{s}_{ax}" for s in SENSORS for ax in ("pitch", "roll")]
CSV_HEADER   = FEATURE_COLS + ["label"]

SAMPLE_RATE_HZ   = 10
COLLECT_SECONDS  = 50           # 500샘플/자세 (논문 권장 수준)
SAMPLES_PER_POSE = SAMPLE_RATE_HZ * COLLECT_SECONDS

POSE_LABELS = ["normal", "forward_head", "kyphosis", "lateral_tilt"]

# ─────────────────────────────────────────
# 시뮬레이션 패턴: [C7p, T7p, T3p, C7r, T7r, T3r]
#
# 벽 baseline 대비 diff 패턴 (단위: °)
# C7: 경추 7번 — 거북목 주 감지 축
# T7: 흉추 7번 — 굽은등 주 감지 축
# T3: 흉추 3번 — 상부 흉추 곡률, C7↔T7 중간 연결점
#
# 임상 근거:
# Harrison et al. (2004): 정상 경추 전만 26°, forward_head 시 C7 +8~12°
# Damasceno et al. (2006): kyphosis T7 pitch +9~14°
# ─────────────────────────────────────────
SIM_PATTERNS = {
    #               C7p    T7p    T3p    C7r    T7r    T3r
    "normal":      [ 0.0,   0.0,   0.0,   0.0,   0.0,   0.0],
    "forward_head":[ 9.0,   3.0,   5.5,   0.8,   0.3,   0.5],
    "kyphosis":    [ 4.0,  11.0,   7.0,   0.5,   0.5,   0.4],
    "lateral_tilt":[ 1.5,   0.8,   1.0,   8.5,   6.5,   7.0],
}
# 실제 IMU 센서(MPU-6050 계열) RMS 오차 ~1.5° + 체간 미세진동 ~1°
# forward_head(9°)↔text_neck(14°) 경계 구간에서 자연스러운 오분류 발생
SIM_NOISE_STD = 2.5


def read_sensor_data() -> tuple[list[float], list[float]]:
    """
    실제 센서 수신 함수. 하드웨어 프로토콜 확정 시 이 함수만 구현하면 됩니다.
    반환: (pitch[C7,T7,T3], roll[C7,T7,T3])
    """
    raise NotImplementedError("실제 센서 연동 필요. --simulate 플래그 사용")


def simulate_sensor_data(label: str, bp: list[float], br: list[float]):
    p = SIM_PATTERNS[label]
    noise = np.random.normal(0, SIM_NOISE_STD, 6)
    pitch = [bp[i] + p[i]   + noise[i]   for i in range(3)]
    roll  = [br[i] + p[i+3] + noise[i+3] for i in range(3)]
    return pitch, roll


def compute_diff(current: list[float], baseline: list[float]) -> list[float]:
    return [current[i] - baseline[i] for i in range(3)]


def interleave(dp: list[float], dr: list[float]) -> list[float]:
    return [val for pair in zip(dp, dr) for val in pair]


def calibrate(simulate: bool) -> tuple[list[float], list[float]]:
    """
    벽 캘리브레이션.
    벽에 등·엉덩이·어깨·머리를 붙이고 선 자세 = 이 사람의 기준 자세.
    개인 체형과 무관하게 동일한 조건에서 baseline이 측정됨.
    """
    print("\n=== 영점 조절 (벽 캘리브레이션) ===")
    print("벽에 등을 붙이고 바르게 선 후 Enter를 누르세요...")
    input()

    if simulate:
        bp = [float(np.random.uniform(10, 30)) for _ in range(3)]
        br = [float(np.random.uniform(-2, 2))  for _ in range(3)]
        print(f"  (시뮬) pitch baseline [C7,T7,T3]: {[f'{v:.1f}' for v in bp]}")
        print(f"  (시뮬) roll  baseline [C7,T7,T3]: {[f'{v:.1f}' for v in br]}")
    else:
        bp, br = read_sensor_data()
        print(f"  pitch baseline: {[f'{v:.1f}' for v in bp]}")
        print(f"  roll  baseline: {[f'{v:.1f}' for v in br]}")

    return bp, br


def collect_pose(label: str, bp: list[float], br: list[float], simulate: bool) -> list[list]:
    print(f"\n자세: [{label}]")
    for i in range(3, 0, -1):
        print(f"  {i}...")
        time.sleep(1)
    print(f"  수집 시작! ({COLLECT_SECONDS}초 유지)")

    samples  = []
    interval = 1.0 / SAMPLE_RATE_HZ

    for i in range(SAMPLES_PER_POSE):
        t = time.time()
        cp, cr = simulate_sensor_data(label, bp, br) if simulate else read_sensor_data()
        dp = compute_diff(cp, bp)
        dr = compute_diff(cr, br)
        samples.append(interleave(dp, dr) + [label])

        sleep = interval - (time.time() - t)
        if sleep > 0:
            time.sleep(sleep)
        if (i + 1) % 100 == 0:
            print(f"  {i+1}/{SAMPLES_PER_POSE} | pitch{[f'{v:.1f}' for v in dp]} roll{[f'{v:.1f}' for v in dr]}")

    print(f"  완료: {len(samples)}개")
    return samples


def save_csv(samples: list[list], append: bool = True):
    os.makedirs(DATA_DIR, exist_ok=True)
    exists = os.path.exists(CSV_PATH)
    mode   = "a" if (append and exists) else "w"
    with open(CSV_PATH, mode, newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if mode == "w" or not exists:
            w.writerow(CSV_HEADER)
        w.writerows(samples)
    print(f"\nCSV 저장: {CSV_PATH} ({len(samples)}행)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulate", action="store_true")
    parser.add_argument("--poses", nargs="+", default=POSE_LABELS, choices=POSE_LABELS)
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f" 자세 데이터 수집기 ({'시뮬레이션' if args.simulate else '실제 센서'})")
    print(f" 센서: {SENSORS}  피처: {len(FEATURE_COLS)}개")
    print(f"{'='*50}")

    bp, br = calibrate(args.simulate)

    all_samples = []
    for label in args.poses:
        all_samples.extend(collect_pose(label, bp, br, args.simulate))
        print(f"  누적: {len(all_samples)}개")

    save_csv(all_samples)
    print("\n다음 단계: python 2_train_model.py")


if __name__ == "__main__":
    main()
