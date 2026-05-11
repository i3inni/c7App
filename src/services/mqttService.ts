/**
 * 실시간 자세 데이터 리스너
 *
 * 흐름: ESP32 → HiveMQ → FastAPI(Railway) → Firestore daily_stats
 *       → 앱 onSnapshot → Zustand store 업데이트
 *
 * FastAPI 서버가 MQTT를 구독하고 Firestore에 기록하므로
 * 앱은 MQTT 클라이언트 없이 Firestore만 구독하면 됨.
 */

import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { DayStats } from '../constants/types';

let unsubscribe: Unsubscribe | null = null;

function todayDocId(userId: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${userId}_${ymd}`;
}

export const startPostureListener = (deviceId: string, userId: string): void => {
  stopPostureListener();

  const docId = todayDocId(userId);
  const ref   = doc(db, 'daily_stats', docId);

  setListenerDeviceId(deviceId);
  useStore.getState().setDevice({ deviceId, mqttStatus: 'connected' });

  unsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data    = snap.data();
    const summary = data.summary ?? {};

    const score = summary.dailyScore ?? 0;
    const angle = summary.avgAngle  ?? 0;
    useStore.getState().updatePosture(score, angle);

    const c7 = summary.c7Angle ?? angle;
    const t3 = summary.t3Angle ?? 0;
    const t7 = summary.t7Angle ?? 0;
    useStore.getState().setAngles({ c7, t3, t7 });

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
      hourlyScores:  data.hourlyScores  ?? {},
      badPostureLogs: data.badPostureLogs ?? [],
    } as DayStats);
  }, () => {
    useStore.getState().setDevice({ mqttStatus: 'error' });
  });
};

export const stopPostureListener = (): void => {
  unsubscribe?.();
  unsubscribe = null;
};

// AppNavigator에서 재연결 여부 판단용
let currentDeviceId = '';
export const setListenerDeviceId = (id: string) => { currentDeviceId = id; };
export const getListenerDeviceId = (): string => currentDeviceId;
