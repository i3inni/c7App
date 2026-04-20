import {
  doc, setDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DeviceState, AppSettings } from '../constants/types';

// Firestore 경로: users/{uid} (단일 문서, 다른 팀원이 account/bodyInfo도 여기에 저장)
const userDoc = (userId: string) => doc(db, 'users', userId);

// ── 헬퍼 ─────────────────────────────────────────────

// ERD: vibrationStrength = "약" | "중" | "강"
// 앱:  vibrationIntensity = 0-100 숫자
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

// ── 기기 설정 저장 ────────────────────────────────────
// ERD 필드: deviceId, vibrationEnabled, vibrationStrength,
//           detectionAngle, powerSaveMode, targetScore
// merge: true → 다른 팀원이 저장한 account/bodyInfo 필드 유지
export const saveDeviceSettings = async (
  userId: string,
  device: Partial<DeviceState>,
) => {
  // 점 표기법으로 개별 필드만 업데이트 → 다른 deviceSettings 필드 덮어쓰기 방지
  const dotFields: Record<string, unknown> = {};

  if (device.deviceId !== undefined)
    dotFields['deviceSettings.deviceId'] = device.deviceId;
  if (device.vibrationEnabled !== undefined)
    dotFields['deviceSettings.vibrationEnabled'] = device.vibrationEnabled;
  if (device.vibrationIntensity !== undefined)
    dotFields['deviceSettings.vibrationStrength'] = intensityToStrength(device.vibrationIntensity);
  if (device.sensorAngle !== undefined)
    dotFields['deviceSettings.detectionAngle'] = device.sensorAngle;
  if (device.powerSaveMode !== undefined)
    dotFields['deviceSettings.powerSaveMode'] = device.powerSaveMode;

  if (Object.keys(dotFields).length === 0) return;

  try {
    await updateDoc(userDoc(userId), dotFields);
  } catch {
    // 문서가 없으면 새로 생성
    const init: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dotFields)) {
      const field = k.split('.')[1];
      if (!init.deviceSettings) init.deviceSettings = {};
      (init.deviceSettings as Record<string, unknown>)[field] = v;
    }
    await setDoc(userDoc(userId), init, { merge: true });
  }
};

// ── 기기 설정 조회 ────────────────────────────────────
export const getDeviceSettings = async (
  userId: string,
): Promise<Partial<DeviceState> | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;

  const ds = snap.data()?.deviceSettings;
  if (!ds) return null;

  return {
    deviceId: ds.deviceId ?? null,
    vibrationEnabled: ds.vibrationEnabled ?? true,
    vibrationIntensity: strengthToIntensity(ds.vibrationStrength ?? '중'),
    sensorAngle: ds.detectionAngle ?? 30,
    powerSaveMode: ds.powerSaveMode ?? false,
  };
};

// ── 알림 설정 저장 ────────────────────────────────────
// ERD 필드: postureAlert, reportAlert
// targetScore는 ERD상 deviceSettings 안에 포함
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
    dotFields['deviceSettings.targetScore'] = settings.targetScore;

  if (Object.keys(dotFields).length === 0) return;

  try {
    await updateDoc(userDoc(userId), dotFields);
  } catch {
    await setDoc(userDoc(userId), {
      ...(settings.postureAlertEnabled !== undefined || settings.reportAlertEnabled !== undefined
        ? { notificationSettings: { postureAlert: settings.postureAlertEnabled, reportAlert: settings.reportAlertEnabled } }
        : {}),
      ...(settings.targetScore !== undefined ? { deviceSettings: { targetScore: settings.targetScore } } : {}),
    }, { merge: true });
  }
};

// ── 알림 설정 조회 ────────────────────────────────────
export const getNotificationSettings = async (
  userId: string,
): Promise<Partial<AppSettings> | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;

  const data = snap.data();
  const ns = data?.notificationSettings;
  const ds = data?.deviceSettings;

  return {
    postureAlertEnabled: ns?.postureAlert ?? true,
    reportAlertEnabled:  ns?.reportAlert  ?? true,
    targetScore:         ds?.targetScore  ?? 85,
  };
};

// ── 기기 연결 상태 업데이트 (BLE 연결/해제 시 호출) ────
// connected=true  → deviceId 기록
// connected=false → deviceId null 로 초기화
export const updateDeviceConnection = async (
  userId: string,
  deviceId: string,
  connected: boolean,
) => {
  try {
    await updateDoc(userDoc(userId), {
      'deviceSettings.deviceId': connected ? deviceId : null,
    });
  } catch {
    await setDoc(userDoc(userId), { deviceSettings: { deviceId: connected ? deviceId : null } }, { merge: true });
  }
};
