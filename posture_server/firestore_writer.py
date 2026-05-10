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
) -> None:
    if not _db: return
    ref = _db.collection("daily_stats").document(_today_doc_id(user_id))
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

        ref.update({
            "summary.dailyScore":       new_score,
            "summary.avgAngle":         new_angle,
            "summary.badPostureCount":  s.get("badPostureCount", 0) + (1 if is_bad    else 0),
            "summary.correctionCount":  s.get("correctionCount", 0) + (1 if corrected else 0),
            "summary.totalUsageTime":   f"{usage_min / 60:.1f}h",
            "summary._sampleCount":     n,
            "summary._totalUsageMin":   usage_min,
            f"hourlyScores.{bucket}":   hourly[bucket],
        })
    else:
        ref.set({
            "userId": user_id,
            "date":   datetime.now().strftime("%Y-%m-%d"),
            "summary": {
                "dailyScore":       float(score),
                "badPostureCount":  1 if is_bad else 0,
                "correctionCount":  0,
                "totalUsageTime":   "0.0h",
                "avgAngle":         angle,
                "_sampleCount":     1,
                "_totalUsageMin":   0.5 / 60,
            },
            "hourlyScores":   {bucket: float(score)},
            "badPostureLogs": [],
        })


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
) -> None:
    if not _db: return
    await asyncio.to_thread(_update_stats_sync, user_id, score, angle, is_bad, corrected)


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
