"""
MQTT 구독자.

ESP32가 500ms마다 C7 / T3 / T7 를 순차 전송합니다.
구독 토픽: posture/+/raw  (+ = deviceId, MAC 소문자 콜론 없음)

payload 구조:
  { "sensor": "C7", "pitch": 12.3, "roll": 1.5, "userId": "guest_...", "ts": 1234567890 }

처리 흐름:
  1. posture/+/raw 구독
  2. 토픽에서 deviceId, payload에서 userId 추출
  3. (deviceId, userId) 조합으로 SensorBuffer 관리
  4. 서버 재시작 시 devices/{deviceId}/calibrations/{userId} 에서 복원
  5. posture_engine.run_inference() 호출
  6. Firestore write (daily_stats/{userId}_{date})
  7. posture/{deviceId}/result publish
  8. alert 시 posture/{deviceId}/alert publish

SSL은 ESP32 setInsecure() 와 동일하게 인증서 검증 생략.
"""

import os
import json
import ssl
import asyncio

import aiomqtt
from dotenv import load_dotenv

from sensor_buffer import SensorBuffer
from posture_engine import ml, run_inference, apply_calibration
from firestore_writer import (
    update_daily_stats,
    update_live_posture,
    on_alert_started,
    load_calibration,
)

load_dotenv()

MQTT_HOST = os.getenv("MQTT_SERVER", "").strip()
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883").strip())
MQTT_USER = os.getenv("MQTT_USER", "").strip()
MQTT_PASS = os.getenv("MQTT_PASS", "").strip()

print(f"MQTT 설정: host={repr(MQTT_HOST)} port={MQTT_PORT} user={repr(MQTT_USER)}")

SUB_TOPIC = "posture/+/raw"

# (device_id, user_id) 조합별 버퍼 및 상태 관리
_buffers:       dict[tuple[str, str], SensorBuffer] = {}
_prev_alert:    dict[tuple[str, str], bool]         = {}
_prev_severity: dict[tuple[str, str], str]          = {}
_cal_loaded:    set[tuple[str, str]]                = set()


def _make_tls() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode    = ssl.CERT_NONE
    return ctx


async def _ensure_calibration(device_id: str, user_id: str) -> None:
    """서버 재시작 후 첫 프레임 수신 시 Firestore에서 캘리브레이션을 복원합니다."""
    key = (device_id, user_id)
    if key in _cal_loaded:
        return
    _cal_loaded.add(key)

    cal = await load_calibration(device_id, user_id)
    if cal:
        apply_calibration(device_id, user_id, cal)
        print(f"✅ [{device_id}/{user_id}] 캘리브레이션 복원 완료")
    else:
        print(f"ℹ️  [{device_id}/{user_id}] 저장된 캘리브레이션 없음 — 기본값 사용")


async def _handle_complete_frame(
    client: aiomqtt.Client,
    device_id: str,
    user_id: str,
    p: list[float],
    r: list[float],
) -> None:
    if not ml.is_ready:
        print(f"⚠️  [{device_id}] ML 모델 미준비 — 추론 건너뜀")
        return

    await _ensure_calibration(device_id, user_id)

    key = (device_id, user_id)
    prev_sev  = _prev_severity.get(key, "normal")
    result    = run_inference(device_id, user_id, p, r)
    score     = result["score"]
    angle     = result["diff_pitch"][0]
    is_bad    = result["is_bad_posture"]
    corrected = (prev_sev != "normal") and (result["severity"] == "normal")

    _prev_severity[key] = result["severity"]

    dp = result["diff_pitch"]  # [C7, T7, T3] 순서 (sensor_buffer._ORDER 기준)
    sensor_angles = {
        "c7": dp[0],
        "t7": dp[1],
        "t3": dp[2],
    }
    await update_daily_stats(user_id, score, angle, is_bad, corrected, sensor_angles)
    await update_live_posture(
        device_id, user_id, score, angle,
        result["severity"], result["pose_en"], result["pose_kr"],
        result["alert"], sensor_angles,
    )

    result_payload = json.dumps({
        "deviceId": device_id,
        "userId":   user_id,
        "score":    score,
        "pose_en":  result["pose_en"],
        "pose_kr":  result["pose_kr"],
        "severity": result["severity"],
        "alert":    result["alert"],
        "diff_pitch": result["diff_pitch"],
        "diff_roll":  result["diff_roll"],
    })
    await client.publish(f"posture/{device_id}/result", result_payload)

    prev_alert = _prev_alert.get(key, False)
    if result["alert"] and not prev_alert:
        await on_alert_started(user_id, device_id, angle, result["pose_kr"], result["severity"])
        alert_payload = json.dumps({
            "deviceId": device_id,
            "userId":   user_id,
            "pose_kr":  result["pose_kr"],
            "severity": result["severity"],
            "angle":    round(angle, 1),
        })
        await client.publish(f"posture/{device_id}/alert", alert_payload)

    _prev_alert[key] = result["alert"]


async def mqtt_listener() -> None:
    """FastAPI lifespan에서 asyncio.create_task()로 실행됩니다."""
    tls = _make_tls()

    while True:
        try:
            async with aiomqtt.Client(
                hostname=MQTT_HOST,
                port=MQTT_PORT,
                username=MQTT_USER,
                password=MQTT_PASS,
                tls_context=tls,
            ) as client:
                await client.subscribe(SUB_TOPIC)
                print(f"✅ MQTT 구독: {MQTT_HOST}:{MQTT_PORT} / {SUB_TOPIC}")

                _msg_count = 0
                async for msg in client.messages:
                    try:
                        parts = str(msg.topic).split("/")
                        if len(parts) != 3:
                            print(f"⚠️  알 수 없는 토픽: {msg.topic}")
                            continue
                        device_id = parts[1]

                        data    = json.loads(msg.payload)
                        sensor  = data.get("sensor", "")
                        pitch   = float(data["pitch"])
                        roll    = float(data["roll"])
                        user_id = data.get("userId", "unknown")

                        if sensor not in ("C7", "T3", "T7"):
                            print(f"⚠️  [{device_id}] 알 수 없는 센서: {sensor}")
                            continue

                        # 첫 메시지 및 100개마다 수신 확인 로그
                        _msg_count += 1
                        if _msg_count == 1:
                            print(f"📡 첫 메시지 수신 — device={device_id} user={user_id} sensor={sensor}")
                        elif _msg_count % 100 == 0:
                            print(f"📡 {_msg_count}번째 메시지 — device={device_id} user={user_id}")

                        buf_key = (device_id, user_id)
                        if buf_key not in _buffers:
                            _buffers[buf_key] = SensorBuffer()
                            print(f"🆕 새 버퍼 생성: device={device_id} user={user_id}")

                        buf = _buffers[buf_key]
                        if buf.is_expired:
                            print(f"⏱️  [{device_id}] 버퍼 만료 → 초기화")
                            buf.clear()

                        buf.update(sensor, pitch, roll)

                        if buf.is_complete:
                            p, r = buf.extract()
                            buf.clear()
                            print(f"✅ 완성 프레임 → 추론: device={device_id} user={user_id} pitch={[round(x,1) for x in p]}")
                            asyncio.create_task(
                                _handle_complete_frame(client, device_id, user_id, p, r)
                            )

                    except json.JSONDecodeError as e:
                        print(f"⚠️  JSON 파싱 오류: {e} | raw={msg.payload[:80]}")
                    except (KeyError, ValueError) as e:
                        print(f"⚠️  데이터 오류: {e} | payload={msg.payload[:80]}")
                    except Exception as e:
                        print(f"❌ 예상치 못한 오류: {type(e).__name__}: {e}")

        except aiomqtt.MqttError as e:
            print(f"⚠️  MQTT 연결 끊김: {e} — 5초 후 재연결")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"❌ MQTT 루프 오류: {type(e).__name__}: {e} — 5초 후 재연결")
            await asyncio.sleep(5)
