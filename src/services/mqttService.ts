/**
 * 실시간 자세 데이터 리스너
 *
 * 흐름: ESP32 → HiveMQ → FastAPI(Railway) → Firestore
 *   ├─ live_posture/{deviceId}  (2초 throttle) → 현재 점수/각도/자세 타입
 *   └─ daily_stats/{userId}_{YYYYMMDD} (10초 throttle) → 오늘 누적 통계
 *
 * FastAPI 서버가 MQTT를 구독하고 Firestore에 기록하므로
 * 앱은 MQTT 클라이언트 없이 Firestore만 구독하면 됨.
 */

import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { DayStats, PostureType } from '../constants/types';

let unsubscribeLive:  Unsubscribe | null = null;
let unsubscribeStats: Unsubscribe | null = null;

function todayDocId(userId: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${userId}_${ymd}`;
}

export const startPostureListener = (deviceId: string, userId: string): void => {
  stopPostureListener();
  setListenerDeviceId(deviceId);
  useStore.getState().setDevice({ deviceId, mqttStatus: 'connected' });

  // 실시간 자세: live_posture/{deviceId} — 2초 주기
  const liveRef = doc(db, 'live_posture', deviceId);
  unsubscribeLive = onSnapshot(liveRef, (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    useStore.getState().updatePosture(d.score ?? 0, d.angle ?? 0, d.pose_en as PostureType);
    if (d.c7Angle !== undefined) {
      useStore.getState().setAngles({ c7: d.c7Angle, t3: d.t3Angle ?? 0, t7: d.t7Angle ?? 0 });
    }
  }, () => {
    useStore.getState().setDevice({ mqttStatus: 'error' });
  });

  // 일별 통계: daily_stats/{userId}_{YYYYMMDD} — 10초 주기
  const statsRef = doc(db, 'daily_stats', todayDocId(userId));
  unsubscribeStats = onSnapshot(statsRef, (snap) => {
    if (!snap.exists()) return;
    const data    = snap.data();
    const summary = data.summary ?? {};
    useStore.getState().setTodayStats({
      uid:          data.uid,
      date:         data.date ?? '',
      summary: {
        dailyScore:      summary.dailyScore      ?? 0,
        badPostureCount: summary.badPostureCount ?? 0,
        correctionCount: summary.correctionCount ?? 0,
        totalUsageTime:  summary.totalUsageTime  ?? '0.0h',
        avgAngle:        summary.avgAngle        ?? 0,
      },
      hourlyScores:   data.hourlyScores   ?? {},
      badPostureLogs: data.badPostureLogs ?? [],
    } as DayStats);
  });
};

export const stopPostureListener = (): void => {
  unsubscribeLive?.();
  unsubscribeLive = null;
  unsubscribeStats?.();
  unsubscribeStats = null;
};

// AppNavigator에서 재연결 여부 판단용
let currentDeviceId = '';
export const setListenerDeviceId = (id: string) => { currentDeviceId = id; };
export const getListenerDeviceId = (): string => currentDeviceId;
