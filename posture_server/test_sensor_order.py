import unittest
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))

from features import RAW_FEATURE_COLS, SENSORS, SENSOR_ORDER, build_features, features_from_raw
from sensor_buffer import SensorBuffer


class SensorOrderTest(unittest.TestCase):
    def test_sensor_order_constant(self) -> None:
        self.assertEqual(list(SENSOR_ORDER), ["C7", "T3", "T7"])
        self.assertEqual(SENSORS, ["C7", "T3", "T7"])

    def test_raw_feature_columns_follow_sensor_order(self) -> None:
        self.assertEqual(
            RAW_FEATURE_COLS,
            [
                "diff_C7_pitch",
                "diff_C7_roll",
                "diff_T3_pitch",
                "diff_T3_roll",
                "diff_T7_pitch",
                "diff_T7_roll",
            ],
        )

    def test_sensor_buffer_extracts_in_c7_t3_t7_order(self) -> None:
        buf = SensorBuffer()
        buf.update("T7", 70.0, 700.0)
        buf.update("C7", 10.0, 100.0)
        buf.update("T3", 30.0, 300.0)

        p, r = buf.extract()
        self.assertEqual(p, [10.0, 30.0, 70.0])
        self.assertEqual(r, [100.0, 300.0, 700.0])

    def test_raw_to_feature_roundtrip_preserves_order(self) -> None:
        dp = [1.0, 2.0, 3.0]
        dr = [10.0, 20.0, 30.0]
        features = build_features(dp, dr)
        rebuilt = features_from_raw(features[:6])

        self.assertEqual(features[:6], rebuilt[:6])
        self.assertEqual(features[6:], rebuilt[6:])


if __name__ == "__main__":
    unittest.main()
