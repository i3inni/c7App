"""
ESP32가 C7 / T3 / T7 메시지를 같은 토픽에 순차 전송하므로,
3개가 모두 도착하면 한 번에 처리할 수 있도록 임시 보관합니다.

서버가 기대하는 센서 순서: [C7, T3, T7]
ESP32 전송 순서:            C7 → T3 → T7  (i=0,1,2)
→ extract() 에서 순서를 맞춰 반환합니다.
"""

import time
from dataclasses import dataclass, field

from features import SENSORS, validate_sensor_order

SENSOR_TIMEOUT = 2.0  # 이 시간 안에 3개가 안 모이면 버퍼 초기화

# 서버(posture_engine)가 기대하는 순서
validate_sensor_order(SENSORS, "sensor_buffer")
_ORDER = SENSORS


@dataclass
class SensorBuffer:
    _data: dict = field(default_factory=dict)   # {"C7": (pitch, roll), ...}
    _ts:   float = field(default_factory=time.monotonic)

    def update(self, sensor: str, pitch: float, roll: float) -> None:
        self._data[sensor] = (pitch, roll)
        self._ts = time.monotonic()

    @property
    def is_complete(self) -> bool:
        return all(s in self._data for s in _ORDER)

    @property
    def is_expired(self) -> bool:
        """데이터가 있는데 SENSOR_TIMEOUT 초 넘게 완성이 안 된 경우."""
        return bool(self._data) and (time.monotonic() - self._ts) > SENSOR_TIMEOUT

    def extract(self) -> tuple[list[float], list[float]]:
        """[C7, T3, T7] 순서로 pitch / roll 반환."""
        p = [self._data[s][0] for s in _ORDER]
        r = [self._data[s][1] for s in _ORDER]
        return p, r

    def clear(self) -> None:
        self._data.clear()
