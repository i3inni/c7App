"""
[Part 1] 자세 데이터 수집 스크립트

ESP32 → HiveMQ MQTT → 이 스크립트 → training_data.csv

실행:
  실제 센서:  python 1_collect_data.py
  시뮬레이션: python 1_collect_data.py --simulate
  특정 자세만: python 1_collect_data.py --poses normal forward_head
  기존 CSV 덮어쓰기: python 1_collect_data.py --reset
"""

import argparse
import asyncio
import csv
import json
import os
import ssl
import time

import aiomqtt
import numpy as np
from dotenv import load_dotenv

from features import RAW_FEATURE_COLS, SENSORS, validate_sensor_order
from sensor_buffer import SensorBuffer

load_dotenv()

# ── 경로 / 상수 ──────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(DATA_DIR, "training_data.csv")

validate_sensor_order(SENSORS, "1_collect_data")
CSV_HEADER   = RAW_FEATURE_COLS + ["label"]

SAMPLES_PER_POSE = 500   # 자세당 500샘플 (~50초, 10Hz 기준)
CALIBRATE_N      = 30    # baseline 평균 프레임 수 (~3초)
POSE_LABELS      = ["normal", "forward_head", "kyphosis", "lateral_tilt"]

# MQTT
MQTT_HOST = os.getenv("MQTT_SERVER", "").strip()
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883").strip())
MQTT_USER = os.getenv("MQTT_USER", "").strip()
MQTT_PASS = os.getenv("MQTT_PASS", "").strip()
SUB_TOPIC = "posture/+/raw"

# 시뮬레이션 패턴 (baseline 대비 diff, [C7p, T3p, T7p, C7r, T3r, T7r])
SIM_PATTERNS = {
    "normal":       [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    "forward_head": [ 9.0,  5.5,  3.0,  0.8,  0.5,  0.3],
    "kyphosis":     [ 4.0,  7.0, 11.0,  0.5,  0.4,  0.5],
    "lateral_tilt": [ 1.5,  1.0,  0.8,  8.5,  7.0,  6.5],
}
SIM_NOISE_STD = 2.5


# ── MQTT 리스너 ──────────────────────────────────────────

def _make_tls() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode    = ssl.CERT_NONE
    return ctx


async def _run_listener(queue: asyncio.Queue, stop: asyncio.Event) -> None:
    """완성된 프레임(3센서 모두 도착)을 queue에 push합니다."""
    buffers: dict[str, SensorBuffer] = {}
    tls = _make_tls()

    async with aiomqtt.Client(
        hostname=MQTT_HOST,
        port=MQTT_PORT,
        username=MQTT_USER,
        password=MQTT_PASS,
        tls_context=tls,
    ) as client:
        await client.subscribe(SUB_TOPIC)
        print(f"  MQTT 연결됨 ({MQTT_HOST}:{MQTT_PORT})")

        async for msg in client.messages:
            if stop.is_set():
                break
            try:
                device_id = str(msg.topic).split("/")[1]
                data      = json.loads(msg.payload)
                sensor    = data.get("sensor", "")
                if sensor not in SENSORS:
                    continue

                buf = buffers.setdefault(device_id, SensorBuffer())
                if buf.is_expired:
                    buf.clear()
                buf.update(sensor, float(data["pitch"]), float(data["roll"]))

                if buf.is_complete:
                    p, r = buf.extract()
                    buf.clear()
                    await queue.put((p, r))
            except Exception:
                continue


async def _get_frames(queue: asyncio.Queue, n: int, desc: str = "") -> list[tuple]:
    """queue에서 n개 프레임을 수집합니다."""
    frames = []
    while len(frames) < n:
        try:
            frame = await asyncio.wait_for(queue.get(), timeout=15.0)
            frames.append(frame)
            done = len(frames)
            if done % 100 == 0 or done == n:
                print(f"  {desc}{done}/{n}", end="\r")
        except asyncio.TimeoutError:
            print("\n  ⚠ 센서 신호 없음 (15초 대기 초과). ESP32가 켜져 있고 WiFi 연결됐는지 확인하세요.")
            raise
    print()
    return frames


# ── 시뮬레이션 ────────────────────────────────────────────

def _sim_frames(label: str, bp: list, br: list, n: int) -> list[tuple]:
    pat   = SIM_PATTERNS[label]
    frames = []
    for _ in range(n):
        noise = np.random.normal(0, SIM_NOISE_STD, 6)
        p = [bp[i] + pat[i]   + noise[i]   for i in range(3)]
        r = [br[i] + pat[i+3] + noise[i+3] for i in range(3)]
        frames.append((p, r))
    return frames


# ── 피처 변환 ─────────────────────────────────────────────

def _to_features(frames: list[tuple], bp: list, br: list, label: str) -> list[list]:
    rows = []
    for p, r in frames:
        dp = [p[i] - bp[i] for i in range(3)]
        dr = [r[i] - br[i] for i in range(3)]
        row = [v for pair in zip(dp, dr) for v in pair] + [label]
        rows.append(row)
    return rows


# ── 캘리브레이션 ──────────────────────────────────────────

async def calibrate(queue: asyncio.Queue | None, simulate: bool) -> tuple[list, list]:
    print("\n=== 영점 조절 ===")
    print("벽에 등·엉덩이·어깨·머리를 붙이고 바르게 선 후 Enter...")
    input()

    if simulate:
        bp = [float(np.random.uniform(10, 30)) for _ in range(3)]
        br = [float(np.random.uniform(-2, 2))  for _ in range(3)]
    else:
        print(f"  {CALIBRATE_N}프레임 수집 중...")
        frames = await _get_frames(queue, CALIBRATE_N, "baseline ")
        bp = [sum(f[0][i] for f in frames) / len(frames) for i in range(3)]
        br = [sum(f[1][i] for f in frames) / len(frames) for i in range(3)]

    print(f"  pitch baseline [C7,T3,T7]: {[f'{v:.1f}' for v in bp]}")
    print(f"  roll  baseline [C7,T3,T7]: {[f'{v:.1f}' for v in br]}")
    return bp, br


# ── 자세 수집 ─────────────────────────────────────────────

async def collect_pose(
    label: str,
    bp: list, br: list,
    queue: asyncio.Queue | None,
    simulate: bool,
) -> list[list]:
    print(f"\n[{label}] 자세를 취하고 준비되면 Enter...")
    input()
    for i in range(3, 0, -1):
        print(f"  {i}...")
        await asyncio.sleep(1)
    print(f"  수집 시작! ({SAMPLES_PER_POSE}샘플)")

    if simulate:
        frames = _sim_frames(label, bp, br, SAMPLES_PER_POSE)
        await asyncio.sleep(0)
    else:
        frames = await _get_frames(queue, SAMPLES_PER_POSE, f"[{label}] ")

    rows = _to_features(frames, bp, br, label)
    print(f"  완료: {len(rows)}개")
    return rows


# ── CSV 저장 ──────────────────────────────────────────────

def save_csv(rows: list[list], reset: bool) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    exists = os.path.exists(CSV_PATH)
    mode   = "w" if (reset or not exists) else "a"
    with open(CSV_PATH, mode, newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if mode == "w":
            w.writerow(CSV_HEADER)
        w.writerows(rows)
    action = "저장" if mode == "w" else "추가"
    print(f"\nCSV {action}: {CSV_PATH}  ({len(rows)}행)")


# ── 메인 ─────────────────────────────────────────────────

async def main_async(args: argparse.Namespace) -> None:
    print(f"\n{'='*52}")
    print(f"  자세 데이터 수집기 ({'시뮬레이션' if args.simulate else '실제 센서'})")
    print(f"  센서: {SENSORS}  /  자세당 {SAMPLES_PER_POSE}샘플")
    print(f"{'='*52}")

    queue: asyncio.Queue | None = None
    stop  = asyncio.Event()
    listener_task = None

    if not args.simulate:
        if not MQTT_HOST:
            print("❌ .env에 MQTT_SERVER가 설정되지 않았습니다.")
            return
        queue = asyncio.Queue()
        listener_task = asyncio.create_task(_run_listener(queue, stop))
        await asyncio.sleep(2)  # 연결 대기

    bp, br = await calibrate(queue, args.simulate)

    all_rows: list[list] = []
    for label in args.poses:
        rows = await collect_pose(label, bp, br, queue, args.simulate)
        all_rows.extend(rows)
        print(f"  누적: {len(all_rows)}개")

    if listener_task:
        stop.set()
        listener_task.cancel()

    save_csv(all_rows, reset=args.reset)
    print("다음 단계: python 2_train_model.py")


def main() -> None:
    parser = argparse.ArgumentParser(description="ESP32 자세 데이터 수집")
    parser.add_argument("--simulate", action="store_true", help="하드웨어 없이 시뮬레이션")
    parser.add_argument("--poses",    nargs="+", default=POSE_LABELS, choices=POSE_LABELS)
    parser.add_argument("--reset",    action="store_true", help="기존 CSV 초기화 후 저장")
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
