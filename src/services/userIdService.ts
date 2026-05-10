import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@c7ai_user_id';

/**
 * guest_{16자리 hex} 형태의 사용자 ID를 생성합니다.
 * crypto.getRandomValues 없이 동작하도록 Date + Math.random 조합.
 */
const generateGuestId = (): string => {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  return `guest_${ts}${rand}`;
};

/**
 * AsyncStorage에서 userId를 읽거나, 없으면 새로 생성해 저장합니다.
 * 앱 최초 실행 시 자동으로 guest ID가 만들어집니다.
 * Firebase 로그인 후에는 Firebase UID로 교체하기 위해 overrideUserId()를 사용합니다.
 */
export const getOrCreateUserId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(USER_ID_KEY);
  if (existing) return existing;

  const newId = generateGuestId();
  await AsyncStorage.setItem(USER_ID_KEY, newId);
  return newId;
};

/**
 * Firebase 로그인 성공 시 호출.
 * guest ID를 Firebase UID로 교체합니다.
 */
export const overrideUserId = async (firebaseUid: string): Promise<void> => {
  await AsyncStorage.setItem(USER_ID_KEY, firebaseUid);
};

/**
 * 로그아웃 또는 계정 초기화 시 userId를 삭제합니다.
 * 다음 getOrCreateUserId() 호출 시 새 guest ID가 발급됩니다.
 */
export const clearUserId = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_ID_KEY);
};

/**
 * 현재 저장된 userId를 반환합니다. 없으면 null.
 * 로그인 상태 확인 용도로 사용합니다.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(USER_ID_KEY);
};

export const isGuestUser = (userId: string): boolean =>
  userId.startsWith('guest_');
