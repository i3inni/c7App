import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, AppSettings } from '../constants/types';

const userDoc = (userId: string) => doc(db, 'users', userId);

// ── 유저 프로필 생성 ─────────────────────────────────
export const createUserProfile = async (userId: string, data: Partial<User>) => {
  await setDoc(userDoc(userId), {
    account: {
      userId,
      nickname: data.nickname ?? '사용자',
      email: data.email ?? null,
      isMember: !data.isGuest,
      createdAt: new Date().toISOString(),
    },
    bodyInfo: {
      height: data.height ?? null,
      weight: data.weight ?? null,
      sittingTime: data.sittingTime ?? null,
      calibrationAngle: null,
    },
    deviceSettings: {
      deviceId: null,
      vibrationEnabled: true,
      vibrationStrength: '중',
      detectionAngle: 30,
      powerSaveMode: false,
      targetScore: 85,
    },
    notificationSettings: {
      postureAlert: true,
      reportAlert: true,
    },
  }, { merge: true });
};

// ── 유저 프로필 조회 ─────────────────────────────────
// 데이터 없는 경우 더미 기본값 반환
export const getUserProfile = async (userId: string): Promise<User | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;

  const data = snap.data();
  const account = data?.account;
  const bodyInfo = data?.bodyInfo;

  return {
    id: account?.userId ?? userId,
    nickname: account?.nickname ?? '사용자',
    email: account?.email ?? undefined,
    height: bodyInfo?.height ?? 170,
    weight: bodyInfo?.weight ?? 65,
    sittingTime: bodyInfo?.sittingTime ?? 8,
    isGuest: !(account?.isMember ?? true),
  };
};

// ── 유저 프로필 수정 (닉네임, 신체정보 등) ─────────────
export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  const payload: Record<string, unknown> = {};

  const accountUpdate: Record<string, unknown> = {};
  if (data.nickname !== undefined) accountUpdate.nickname = data.nickname;
  if (data.email !== undefined) accountUpdate.email = data.email;
  if (Object.keys(accountUpdate).length > 0) payload.account = accountUpdate;

  const bodyUpdate: Record<string, unknown> = {};
  if (data.height !== undefined) bodyUpdate.height = data.height;
  if (data.weight !== undefined) bodyUpdate.weight = data.weight;
  if (data.sittingTime !== undefined) bodyUpdate.sittingTime = data.sittingTime;
  if (Object.keys(bodyUpdate).length > 0) payload.bodyInfo = bodyUpdate;

  if (Object.keys(payload).length > 0) {
    await setDoc(userDoc(userId), payload, { merge: true });
  }
};

// ── 앱 설정 조회 (알림, 목표점수 등) ────────────────────
// 데이터 없는 경우 더미 기본값 반환
export const getUserSettings = async (userId: string): Promise<AppSettings | null> => {
  const snap = await getDoc(userDoc(userId));
  if (!snap.exists()) return null;

  const data = snap.data();
  const ns = data?.notificationSettings;
  const ds = data?.deviceSettings;

  return {
    postureAlertEnabled: ns?.postureAlert ?? true,
    reportAlertEnabled: ns?.reportAlert ?? true,
    targetScore: ds?.targetScore ?? 85,
  };
};

// ── 앱 설정 저장 → deviceService에 위임 ─────────────────
// 실제 저장은 deviceService.saveNotificationSettings 사용
export const updateUserSettings = async (_userId: string, _settings: Partial<AppSettings>) => {
  // delegated to deviceService
};
