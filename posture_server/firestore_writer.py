"""
Firebase Admin SDK를 이용한 Firestore write 담당 모듈.

식별 구조:
  deviceId = MAC 주소 (소문자, 콜론 없음) — 하드웨어 식별
  userId   = guest UUID 또는 Firebase UID — 사용자 식별

컬렉션 구조:
  devices/{deviceId}/
    calibrations/{userId}              — 사용자별 캘리브레이션 (서브컬렉션)

  daily_stats/{userId}_{YYYYMMDD}/    — 사용자별 일별 통계 (기기 공유해도 분리됨)
    summary, hourlyScores, badPostureLogs

  notifications/                       — 자세 경보 알림 (userId 필드 포함)

firebase-admin은 동기 API이므로 asyncio.to_thread로 래핑합니다.
"""

import os
import asyncio
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore

_db = None
try:
    _sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if _sa_json:
        import json
        firebase_admin.initialize_app(credentials.Certificate(json.loads(_sa_json)))
    else:
        _cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT", "serviceAccountKey.json")
        firebase_admin.initialize_app(credentials.Certificate(_cred_path))
    _db = firestore.client()
    print("✅ Firestore 연결 성공")
except Exception as e:
    print(f"⚠️  Firestore 비활성화 (서비스 계정 없음): {e}")

# 기기별 알림 쿨다운 (동일 userId+deviceId 조합)
NOTIF_COOLDOWN = 300.0  # 초
_last_notif_ts: dict[str, float] = {}  # "{deviceId}:{userId}" → 마지막 알림 시각

# Firestore 쓰기 throttle — 500ms마다 쓰면 하루 할당량 초과
STATS_WRITE_INTERVAL = 10.0  # 초: userId당 최대 1회/10초
_last_stats_write_ts: dict[str, float] = {}  # userId → 마지막 write 시각

# live_posture 실시간 쓰기 throttle — deviceId당 최대 1회/2초
LIVE_WRITE_INTERVAL = 2.0
_last_live_write_ts: dict[str, float] = {}  # deviceId → 마지막 write 시각


# ── 헬퍼 ────────────────────────────────────────────────

def _today_doc_id(user_id: str) -> str:
    """daily_stats 문서 ID: {userId}_{YYYYMMDD}"""
    return f"{user_id}_{datetime.now().strftime('%Y%m%d')}"


def _hour_bucket() -> str:
    h = datetime.now().hour
    start = (h // 3) * 3
    return f"{start:02d}_{start + 3:02d}"


def _cal_ref(device_id: str, user_id: str):
    return (
        _db.collection("devices")
           .document(device_id)
           .collection("calibrations")
           .document(user_id)
    )


# ── 캘리브레이션 영속화 ──────────────────────────────────

def _save_calibration_sync(device_id: str, user_id: str, cal: dict) -> None:
    if not _db: return
    _cal_ref(device_id, user_id).set(cal)


def _load_calibration_sync(device_id: str, user_id: str) -> dict | None:
    if not _db: return None
    snap = _cal_ref(device_id, user_id).get()
    return snap.to_dict() if snap.exists else None


async def save_calibration(device_id: str, user_id: str, cal: dict) -> None:
    if not _db: return
    await asyncio.to_thread(_save_calibration_sync, device_id, user_id, cal)


async def load_calibration(device_id: str, user_id: str) -> dict | None:
    if not _db: return None
    return await asyncio.to_thread(_load_calibration_sync, device_id, user_id)


# ── 일별 통계 ────────────────────────────────────────────

def _update_stats_sync(
    user_id: str,
    score: int,
    angle: float,
    is_bad: bool,
    corrected: bool,
    sensor_angles: dict | None = None,  # {"c7": float, "t3": float, "t7": float}
) -> None:
    if not _db: return
    doc_id = _today_doc_id(user_id)
    ref = _db.collection("daily_stats").document(doc_id)
    bucket = _hour_bucket()

    snap = ref.get()

    if snap.exists:
        data = snap.to_dict()
        s = data.get("summary", {})
        n = s.get("_sampleCount", 0) + 1

        prev_score = s.get("dailyScore", float(score))
        prev_angle = s.get("avgAngle",   angle)
        new_score  = round(prev_score + (score - prev_score) / n, 1)
        new_angle  = round(prev_angle + (angle - prev_angle) / n, 1)
        usage_min  = s.get("_totalUsageMin", 0.0) + (0.5 / 60)

        hourly = data.get("hourlyScores", {})
        prev_h = hourly.get(bucket, float(score))
        hourly[bucket] = round(prev_h * 0.8 + score * 0.2, 1)

        update_data = {
            "summary.dailyScore":       new_score,
            "summary.avgAngle":         new_angle,
            "summary.badPostureCount":  s.get("badPostureCount", 0) + (1 if is_bad    else 0),
            "summary.correctionCount":  s.get("correctionCount", 0) + (1 if corrected else 0),
            "summary.totalUsageTime":   f"{usage_min / 60:.1f}h",
            "summary._sampleCount":     n,
            "summary._totalUsageMin":   usage_min,
            f"hourlyScores.{bucket}":   hourly[bucket],
        }
        if sensor_angles:
            update_data["summary.c7Angle"] = round(sensor_angles["c7"], 1)
            update_data["summary.t3Angle"] = round(sensor_angles["t3"], 1)
            update_data["summary.t7Angle"] = round(sensor_angles["t7"], 1)

        ref.update(update_data)
        print(f"📊 Firestore 업데이트: {doc_id} | score={new_score} angle={new_angle} bad={is_bad} n={n}")
    else:
        summary = {
            "dailyScore":       float(score),
            "badPostureCount":  1 if is_bad else 0,
            "correctionCount":  0,
            "totalUsageTime":   "0.0h",
            "avgAngle":         angle,
            "_sampleCount":     1,
            "_totalUsageMin":   0.5 / 60,
        }
        if sensor_angles:
            summary["c7Angle"] = round(sensor_angles["c7"], 1)
            summary["t3Angle"] = round(sensor_angles["t3"], 1)
            summary["t7Angle"] = round(sensor_angles["t7"], 1)

        ref.set({
            "userId": user_id,
            "date":   datetime.now().strftime("%Y-%m-%d"),
            "summary":        summary,
            "hourlyScores":   {bucket: float(score)},
            "badPostureLogs": [],
        })
        print(f"📊 Firestore 신규 문서 생성: {doc_id} | score={score} angle={angle}")


def _add_bad_log_sync(user_id: str, angle: float) -> None:
    if not _db: return
    ref = _db.collection("daily_stats").document(_today_doc_id(user_id))
    now = datetime.now()
    ref.update({
        "badPostureLogs": firestore.ArrayUnion([{
            "time":     now.strftime("%H:%M"),
            "angle":    round(angle, 1),
            "duration": "5초+",
        }])
    })


def _create_notif_sync(user_id: str, device_id: str, pose_kr: str, severity: str) -> None:
    if not _db: return
    _db.collection("notifications").add({
        "userId":    user_id,
        "deviceId":  device_id,
        "type":      "danger",
        "title":     "자세 경고" if severity == "severe" else "자세 주의",
        "message":   f"{pose_kr} 자세가 감지되었습니다.",
        "timestamp": firestore.SERVER_TIMESTAMP,
    })


# ── 비동기 인터페이스 ────────────────────────────────────

async def update_daily_stats(
    user_id: str,
    score: int,
    angle: float,
    is_bad: bool,
    corrected: bool,
    sensor_angles: dict | None = None,
) -> None:
    if not _db:
        print(f"⚠️  Firestore 비활성화 — 쓰기 건너뜀 (user={user_id})")
        return

    now = asyncio.get_event_loop().time()
    last = _last_stats_write_ts.get(user_id, 0.0)
    if now - last < STATS_WRITE_INTERVAL:
        return
    _last_stats_write_ts[user_id] = now

    try:
        await asyncio.to_thread(_update_stats_sync, user_id, score, angle, is_bad, corrected, sensor_angles)
    except Exception as e:
        print(f"❌ Firestore 쓰기 실패: {type(e).__name__}: {e} (user={user_id})")


async def on_alert_started(
    user_id: str,
    device_id: str,
    angle: float,
    pose_kr: str,
    severity: str,
) -> None:
    """alert 첫 발생: 불량 로그 + 알림 생성 (사용자-기기 조합 쿨다운)."""
    await asyncio.to_thread(_add_bad_log_sync, user_id, angle)

    now = time.monotonic()
    cooldown_key = f"{device_id}:{user_id}"
    last = _last_notif_ts.get(cooldown_key, 0.0)
    if now - last >= NOTIF_COOLDOWN:
        _last_notif_ts[cooldown_key] = now
        await asyncio.to_thread(_create_notif_sync, user_id, device_id, pose_kr, severity)


# ── 실시간 자세 (live_posture) ───────────────────────────

def _update_live_sync(
    device_id: str,
    user_id: str,
    score: int,
    angle: float,
    severity: str,
    pose_en: str,
    pose_kr: str,
    alert: bool,
    sensor_angles: dict | None,
) -> None:
    if not _db:
        return
    data: dict = {
        "userId":    user_id,
        "score":     score,
        "angle":     round(angle, 1),
        "severity":  severity,
        "pose_en":   pose_en,
        "pose_kr":   pose_kr,
        "alert":     alert,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if sensor_angles:
        data["c7Angle"] = round(sensor_angles["c7"], 1)
        data["t3Angle"] = round(sensor_angles["t3"], 1)
        data["t7Angle"] = round(sensor_angles["t7"], 1)
        data["c7Roll"]  = round(sensor_angles.get("c7Roll", 0.0), 1)
        data["t3Roll"]  = round(sensor_angles.get("t3Roll", 0.0), 1)
        data["t7Roll"]  = round(sensor_angles.get("t7Roll", 0.0), 1)
    _db.collection("live_posture").document(device_id).set(data)


# ── 학습 샘플 ────────────────────────────────────────────

TRAINING_COLLECTION = "training_samples"
SENSORS      = ["C7", "T3", "T7"]
FEATURE_COLS = [f"diff_{s}_{ax}" for s in SENSORS for ax in ("pitch", "roll")]


def _save_training_sample_sync(user_id: str, label: str, features: list[float]) -> None:
    if not _db:
        return
    doc = {f: features[i] for i, f in enumerate(FEATURE_COLS)}
    doc["label"]     = label
    doc["userId"]    = user_id
    doc["createdAt"] = firestore.SERVER_TIMESTAMP
    _db.collection(TRAINING_COLLECTION).add(doc)


def _fetch_all_training_samples_sync() -> list[dict]:
    if not _db:
        return []
    docs = _db.collection(TRAINING_COLLECTION).stream()
    return [d.to_dict() for d in docs]


async def save_training_sample(user_id: str, label: str, features: list[float]) -> None:
    if not _db:
        return
    await asyncio.to_thread(_save_training_sample_sync, user_id, label, features)


async def fetch_all_training_samples() -> list[dict]:
    if not _db:
        return []
    return await asyncio.to_thread(_fetch_all_training_samples_sync)


async def update_live_posture(
    device_id: str,
    user_id: str,
    score: int,
    angle: float,
    severity: str,
    pose_en: str,
    pose_kr: str,
    alert: bool,
    sensor_angles: dict | None = None,
) -> None:
    if not _db:
        return
    now = asyncio.get_event_loop().time()
    last = _last_live_write_ts.get(device_id, 0.0)
    if now - last < LIVE_WRITE_INTERVAL:
        return
    _last_live_write_ts[device_id] = now
    try:
        await asyncio.to_thread(
            _update_live_sync,
            device_id, user_id, score, angle, severity, pose_en, pose_kr, alert, sensor_angles,
        )
    except Exception as e:
        print(f"❌ live_posture 쓰기 실패: {type(e).__name__}: {e} (device={device_id})")
