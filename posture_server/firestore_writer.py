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
import math
import calendar
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

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
from features import RAW_FEATURE_COLS as FEATURE_COLS  # Firestore엔 raw 6개만 저장


def _save_training_sample_sync(
    user_id: str,
    label: str,
    features: list[float],
    source: str = "auto",
    label_source: str = "rule",
    confidence: float = 0.0,
    device_id: str = "",
    approved_for_training: bool = False,
    sensor_stability_score: float | None = None,
    hold_duration_sec: float | None = None,
    rule_model_agree: bool | None = None,
    intensity: str | None = None,
    quality: str | None = None,
    notes: str | None = None,
    collected_by: str | None = None,
    session_id: str | None = None,
) -> None:
    if not _db:
        return
    doc = {f: features[i] for i, f in enumerate(FEATURE_COLS)}
    doc["label"]                = label
    doc["userId"]               = user_id
    doc["createdAt"]            = firestore.SERVER_TIMESTAMP
    doc["source"]               = source            # "guided" | "auto"
    doc["label_source"]         = label_source      # "human" | "rule" | "model"
    doc["confidence"]           = confidence        # 모델 확신도 (human=1.0)
    doc["device_id"]            = device_id
    doc["approved_for_training"] = approved_for_training
    doc["intensity"]            = intensity or "none"       # "none" | "mild" | "medium" | "strong"
    doc["quality"]              = quality or ("approved" if approved_for_training else "unreviewed")
    if sensor_stability_score is not None:
        doc["sensor_stability_score"] = sensor_stability_score
    if hold_duration_sec is not None:
        doc["hold_duration_sec"] = hold_duration_sec
    if rule_model_agree is not None:
        doc["rule_model_agree"] = rule_model_agree
    if notes:
        doc["notes"] = notes
    if collected_by:
        doc["collectedBy"] = collected_by
    if session_id:
        doc["sessionId"] = session_id
    _db.collection(TRAINING_COLLECTION).add(doc)


def _fetch_training_samples_sync(
    sources: list[str] | None = None,
    approved_only: bool = False,
) -> list[dict]:
    if not _db:
        return []
    query = _db.collection(TRAINING_COLLECTION)
    if sources:
        query = query.where(filter=FieldFilter("source", "in", sources))
    if approved_only:
        query = query.where(filter=FieldFilter("approved_for_training", "==", True))
    return [d.to_dict() for d in query.stream()]


async def save_training_sample(
    user_id: str,
    label: str,
    features: list[float],
    source: str = "auto",
    label_source: str = "rule",
    confidence: float = 0.0,
    device_id: str = "",
    approved_for_training: bool = False,
    sensor_stability_score: float | None = None,
    hold_duration_sec: float | None = None,
    rule_model_agree: bool | None = None,
    intensity: str | None = None,
    quality: str | None = None,
    notes: str | None = None,
    collected_by: str | None = None,
    session_id: str | None = None,
) -> None:
    if not _db:
        return
    await asyncio.to_thread(
        _save_training_sample_sync,
        user_id, label, features,
        source, label_source, confidence, device_id, approved_for_training,
        sensor_stability_score, hold_duration_sec, rule_model_agree,
        intensity, quality, notes, collected_by, session_id,
    )


async def fetch_training_samples(
    sources: list[str] | None = None,
    approved_only: bool = False,
) -> list[dict]:
    """
    sources=None  → 전체
    sources=["guided"]  → guided만
    sources=["guided", "auto"]  → 둘 다
    approved_only=True  → approved_for_training=True 인 것만
    """
    if not _db:
        return []
    return await asyncio.to_thread(_fetch_training_samples_sync, sources, approved_only)


# 하위 호환 — 기존 코드에서 fetch_all_training_samples() 호출하는 곳을 위해 유지
async def fetch_all_training_samples() -> list[dict]:
    return await fetch_training_samples()


# ── 주간 통계 집계 ────────────────────────────────────────

_KR_DAYS = ["월", "화", "수", "목", "금", "토", "일"]  # weekday(): 월=0
_DEFAULT_TARGET_SCORE = 85


def _week_index(day: int) -> int:
    return math.ceil(day / 7)


def _period_month(dt: datetime) -> str:
    return f"{dt.year}-{dt.month:02d}"


def _week_day_range(dt: datetime) -> tuple[int, int]:
    wi = _week_index(dt.day)
    start = (wi - 1) * 7 + 1
    end = min(wi * 7, calendar.monthrange(dt.year, dt.month)[1])
    return start, end


def _get_target_score_sync(user_id: str) -> int:
    if not _db:
        return _DEFAULT_TARGET_SCORE
    snap = _db.collection("users").document(user_id).get()
    if not snap.exists:
        return _DEFAULT_TARGET_SCORE
    return snap.to_dict().get("deviceSettings", {}).get("targetScore", _DEFAULT_TARGET_SCORE)


def _aggregate_user_week_sync(user_id: str, target_date: datetime) -> None:
    wi = _week_index(target_date.day)
    pm = _period_month(target_date)
    start_day, end_day = _week_day_range(target_date)

    # 이번 주 target_date까지의 daily_stats 수집 (데이터 있는 날만)
    daily_rows: list[tuple[datetime, dict]] = []
    for day in range(start_day, min(target_date.day, end_day) + 1):
        dt = target_date.replace(day=day)
        doc_id = f"{user_id}_{dt.strftime('%Y%m%d')}"
        snap = _db.collection("daily_stats").document(doc_id).get()
        if snap.exists:
            daily_rows.append((dt, snap.to_dict()))

    if not daily_rows:
        return

    scores = [round(r["summary"]["dailyScore"]) for _, r in daily_rows]
    avg_score = round(sum(scores) / len(scores), 1)

    target_score = _get_target_score_sync(user_id)
    target_success = sum(1 for s in scores if s >= target_score)

    breakdown = []
    for i, (dt, row) in enumerate(daily_rows):
        score = round(row["summary"]["dailyScore"])
        prev = round(daily_rows[i - 1][1]["summary"]["dailyScore"]) if i > 0 else score
        breakdown.append({"day": _KR_DAYS[dt.weekday()], "score": score, "change": score - prev})

    # 이전 주 avgScore로 scoreChange 계산
    prev_avg = 0.0
    if wi > 1:
        prev_snap = _db.collection("weekly_stats").document(f"{user_id}_{pm}_{wi - 1}").get()
        if prev_snap.exists:
            prev_avg = prev_snap.to_dict().get("avgScore", 0.0)

    doc_id = f"{user_id}_{pm}_{wi}"
    _db.collection("weekly_stats").document(doc_id).set({
        "uid":               user_id,
        "periodMonth":       pm,
        "weekIndex":         wi,
        "avgScore":          avg_score,
        "scoreChange":       round(avg_score - prev_avg, 1),
        "targetSuccessDays": f"{target_success}/{len(daily_rows)}",
        "dailyBreakdown":    breakdown,
    })
    print(f"✅ weekly_stats 업서트: {doc_id} | avg={avg_score} days={len(daily_rows)} target={target_success}/{len(daily_rows)}")


def _aggregate_weekly_stats_sync(target_date: datetime) -> None:
    if not _db:
        return
    date_str = target_date.strftime("%Y-%m-%d")
    docs = list(_db.collection("daily_stats").where(filter=FieldFilter("date", "==", date_str)).stream())
    user_ids = list({
        (d.to_dict().get("userId") or d.to_dict().get("uid"))
        for d in docs
    } - {None, ""})

    if not user_ids:
        print(f"📊 weekly aggregation ({date_str}): 데이터 없음")
        return

    print(f"📊 weekly aggregation ({date_str}): {len(user_ids)}명 처리")
    for user_id in user_ids:
        try:
            _aggregate_user_week_sync(user_id, target_date)
        except Exception as e:
            print(f"❌ weekly aggregation 실패 (user={user_id}): {e}")


async def aggregate_weekly_stats(target_date: datetime) -> None:
    if not _db:
        return
    await asyncio.to_thread(_aggregate_weekly_stats_sync, target_date)


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


# ── 탈락 auto 샘플 정리 ──────────────────────────────────

AUTO_SAMPLE_TTL_DAYS = 7  # 탈락 auto 샘플 보관 기간


def _cleanup_rejected_auto_sync() -> int:
    """approved=False인 auto 샘플 중 TTL 지난 것 삭제. 삭제 건수 반환."""
    if not _db:
        return 0

    cutoff = datetime.utcnow() - timedelta(days=AUTO_SAMPLE_TTL_DAYS)

    docs = (
        _db.collection(TRAINING_COLLECTION)
           .where(filter=FieldFilter("source", "==", "auto"))
           .where(filter=FieldFilter("approved_for_training", "==", False))
           .stream()
    )

    deleted = 0
    for doc in docs:
        data = doc.to_dict()
        created_at = data.get("createdAt")
        if created_at is None:
            continue
        # Firestore Timestamp → datetime
        ts = created_at if isinstance(created_at, datetime) else created_at.replace(tzinfo=None)
        if hasattr(ts, 'timestamp'):
            ts = datetime.utcfromtimestamp(ts.timestamp())
        if ts < cutoff:
            doc.reference.delete()
            deleted += 1

    return deleted


async def cleanup_rejected_auto_samples() -> int:
    if not _db:
        return 0
    deleted = await asyncio.to_thread(_cleanup_rejected_auto_sync)
    print(f"🧹 탈락 auto 샘플 정리: {deleted}개 삭제 (7일 초과)")
    return deleted
