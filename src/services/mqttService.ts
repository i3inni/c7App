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
import { PostureType } from '../constants/types';

let unsubscribe: Unsubscribe | null = null;

function todayDocId(userId: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${userId}_${ymd}`;
}

export const startPostureListener = (deviceId: string, userId: string): void => {
  stopPostureListener();

  const docId = todayDocId(userId);
  const ref   = doc(db, 'daily_stats', docId);

  useStore.getState().setDevice({ deviceId, mqttStatus: 'connected' });

  unsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data    = snap.data();
    const summary = data.summary ?? {};

    const score = summary.dailyScore ?? 0;
    const angle = summary.avgAngle  ?? 0;

    useStore.getState().updatePosture(score, angle);

    const c7 = summary.c7Angle ?? null;
    const t3 = summary.t3Angle ?? null;
    const t7 = summary.t7Angle ?? null;
    if (c7 !== null && t3 !== null && t7 !== null) {
      useStore.getState().setAngles({ c7, t3, t7 });
    }
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
