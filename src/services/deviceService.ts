import {
  doc, collection, setDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DeviceState, AppSettings } from '../constants/types';

// ── 경로 헬퍼 ─────────────────────────────────────────

// 기기 문서: devices/{deviceId}
const deviceDoc = (deviceId: string) =>
  doc(db, 'devices', deviceId);

// 사용자별 캘리브레이션: devices/{deviceId}/calibrations/{userId}
const calibrationDoc = (deviceId: string, userId: string) =>
  doc(db, 'devices', deviceId, 'calibrations', userId);

// 유저 문서: users/{userId}
const userDoc = (userId: string) =>
  doc(db, 'users', userId);


// ── 타입 변환 헬퍼 ────────────────────────────────────

function intensityToStrength(intensity: number): '약' | '중' | '강' {
  if (intensity <= 33) return '약';
  if (intensity <= 66) return '중';
  return '강';
}

function strengthToIntensity(strength: string): number {
  if (strength === '약') return 33;
  if (strength === '중') return 66;
  return 100;
}


// ══════════════════════════════════════════════════════
// 기기 설정 — devices/{deviceId}  (비회원 지원, uid 불필요)
// ══════════════════════════════════════════════════════

export const saveDeviceSettings = async (
  deviceId: string,
  device: Partial<DeviceState>,
) => {
  const dotFields: Record<string, unknown> = {};

  if (device.vibrationEnabled !== undefined)
    dotFields['settings.vibrationEnabled'] = device.vibrationEnabled;
  if (device.vibrationIntensity !== undefined)
    dotFields['settings.vibrationStrength'] = intensityToStrength(device.vibrationIntensity);
  if (device.sensorAngle !== undefined)
    dotFields['settings.detectionAngle'] = device.sensorAngle;
  if (device.powerSaveMode !== undefined)
    dotFields['settings.powerSaveMode'] = device.powerSaveMode;

  if (Object.keys(dotFields).length === 0) return;

  try {
    await updateDoc(deviceDoc(deviceId), dotFields);
  } catch {
    const settings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dotFields)) {
      settings[k.split('.')[1]] = v;
    }
    await setDoc(deviceDoc(deviceId), { settings }, { merge: true });
  }
};

export const getDeviceSettings = async (
  deviceId: string,
): Promise<Partial<DeviceState> | null> => {
  const snap = await getDoc(deviceDoc(deviceId));
  if (!snap.exists()) return null;

  const s = snap.data()?.settings;
  if (!s) return null;

  return {
    deviceId:           deviceId,
    vibrationEnabled:   s.vibrationEnabled ?? true,
    vibrationIntensity: strengthToIntensity(s.vibrationStrength ?? '중'),
    sensorAngle:        s.detectionAngle ?? 30,
    powerSaveMode:      s.powerSaveMode ?? false,
  };
};


// ══════════════════════════════════════════════════════
// 캘리브레이션 — devices/{deviceId}/calibrations/{userId}
// 사용자별로 분리 저장 → 동일 기기를 여러 사용자가 공유해도 캘리브레이션 독립
// ══════════════════════════════════════════════════════

export interface CalibrationData {
  baselinePitch: number[];   // [C7, T7, T3]
  baselineRoll:  number[];
  heightCm:      number;
  weightKg:      number;
  age:           number;
}

/**
 * 캘리브레이션 저장.
 * 실제 서버 저장은 FastAPI POST /calibrate 가 담당하며,
 * 이 함수는 앱 측 미러링 용도 (오프라인 캐시 또는 설정 화면 표시용).
 */
export const saveDeviceCalibration = async (
  deviceId: string,
  userId: string,
  cal: CalibrationData,
) => {
  await setDoc(calibrationDoc(deviceId, userId), {
    baseline_pitch: cal.baselinePitch,
    baseline_roll:  cal.baselineRoll,
    height_cm:      cal.heightCm,
    weight_kg:      cal.weightKg,
    age:            cal.age,
  });
};

export const getDeviceCalibration = async (
  deviceId: string,
  userId: string,
): Promise<CalibrationData | null> => {
  const snap = await getDoc(calibrationDoc(deviceId, userId));
  if (!snap.exists()) return null;

  const c = snap.data();
  return {
    baselinePitch: c.baseline_pitch ?? [0, 0, 0],
    baselineRoll:  c.baseline_roll  ?? [0, 0, 0],
    heightCm:      c.height_cm      ?? 170,
    weightKg:      c.weight_kg      ?? 65,
    age:           c.age            ?? 25,
  };
};


// ══════════════════════════════════════════════════════
// 유저-기기 연결 — users/{userId}  (로그인 사용자 전용)
// ══════════════════════════════════════════════════════

/**
 * 로그인한 유저와 기기(MAC) 연결.
 * 비회원은 호출 불필요 — daily_stats는 userId 기반이라 연결 없어도 동작.
 */
export const linkDeviceToUser = async (
  userId: string,
  deviceId: string,
) => {
  try {
    await updateDoc(userDoc(userId), { linkedDevice: deviceId });
  } catch {
    await setDoc(userDoc(userId), { linkedDevice: deviceId }, { merge: true });
  }
};

export const getLinkedDevice = async (
  userId: string,
): Promise<string | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;
  return snap.data()?.linkedDevice ?? null;
};

export const unlinkDevice = async (userId: string) => {
  try {
    await updateDoc(userDoc(userId), { linkedDevice: null });
  } catch { /* 문서 없으면 무시 */ }
};

/**
 * BLE 연결/해제 시 호출하는 헬퍼.
 * connected=true  → users/{userId}/linkedDevice = deviceId  +  devices/{deviceId} lastSeen 갱신
 * connected=false → users/{userId}/linkedDevice = null
 */
export const updateDeviceConnection = async (
  userId: string,
  deviceId: string,
  connected: boolean,
) => {
  if (connected) {
    await linkDeviceToUser(userId, deviceId);
    // 기기 문서에 마지막 연결 시각 기록 (optional)
    try {
      await setDoc(deviceDoc(deviceId), { lastSeen: new Date().toISOString() }, { merge: true });
    } catch { /* 무시 */ }
  } else {
    await unlinkDevice(userId);
  }
};


// ══════════════════════════════════════════════════════
// 알림 설정 — users/{userId}  (로그인 사용자 전용)
// 비회원은 로컬 AsyncStorage에서 관리
// ══════════════════════════════════════════════════════

export const saveNotificationSettings = async (
  userId: string,
  settings: Partial<AppSettings>,
) => {
  const dotFields: Record<string, unknown> = {};

  if (settings.postureAlertEnabled !== undefined)
    dotFields['notificationSettings.postureAlert'] = settings.postureAlertEnabled;
  if (settings.reportAlertEnabled !== undefined)
    dotFields['notificationSettings.reportAlert'] = settings.reportAlertEnabled;
  if (settings.targetScore !== undefined)
    dotFields['notificationSettings.targetScore'] = settings.targetScore;

  if (Object.keys(dotFields).length === 0) return;

  try {
    await updateDoc(userDoc(userId), dotFields);
  } catch {
    await setDoc(userDoc(userId), {
      notificationSettings: {
        postureAlert: settings.postureAlertEnabled,
        reportAlert:  settings.reportAlertEnabled,
        targetScore:  settings.targetScore,
      },
    }, { merge: true });
  }
};

export const getNotificationSettings = async (
  userId: string,
): Promise<Partial<AppSettings> | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;

  const ns = snap.data()?.notificationSettings;
  if (!ns) return null;

  return {
    postureAlertEnabled: ns.postureAlert ?? true,
    reportAlertEnabled:  ns.reportAlert  ?? true,
    targetScore:         ns.targetScore  ?? 85,
  };
};
