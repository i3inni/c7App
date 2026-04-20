import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface UserAccount {
  userId: string;
  nickname: string;
  email: string;
  isMember: boolean;
  createdAt: string;
}

export interface UserBodyInfo {
  height: number;
  weight: number;
  sittingTime?: number;
  calibrationAngle?: number;
}

export interface UserDeviceSettings {
  deviceId?: string;
  vibrationEnabled?: boolean;
  vibrationStrength?: string;
  detectionAngle?: number;
  powerSaveMode?: boolean;
  targetScore?: number;
}

export interface UserNotificationSettings {
  postureAlert: boolean;
  reportAlert: boolean;
}

export interface UserDoc {
  account: UserAccount;
  bodyInfo: UserBodyInfo;
  deviceSettings: UserDeviceSettings;
  notificationSettings: UserNotificationSettings;
}

const userRef = (userId: string) => doc(db, 'users', userId);

// 회원가입 완료 시 Firestore에 유저 문서를 처음 만들 때 씁니다.
// data로 전달한 값이 없는 필드는 기본값으로 채워집니다.
export const createUserDoc = async (userId: string, data: Partial<UserDoc>): Promise<void> => {
  const defaults: UserDoc = {
    account: {
      userId,
      nickname: '',
      email: '',
      isMember: true,
      createdAt: new Date().toISOString(),
      ...data.account,
    },
    bodyInfo: {
      height: 0,
      weight: 0,
      calibrationAngle: 0,
      ...data.bodyInfo,
    },
    deviceSettings: {
      targetScore: 85,
      ...data.deviceSettings,
    },
    notificationSettings: {
      postureAlert: true,
      reportAlert: true,
      ...data.notificationSettings,
    },
  };
  await setDoc(userRef(userId), defaults);
};

// 내 정보 화면, 설정 화면 진입 시 저장된 값 전체를 불러올 때 씁니다.
export const getUserDoc = async (userId: string): Promise<UserDoc | null> => {
  const snap = await getDoc(userRef(userId));
  if (!snap.exists()) return null;
  return snap.data() as UserDoc;
};

// 내 정보 화면에서 키 또는 체중을 수정하고 저장할 때 씁니다.
export const updateBodyInfo = async (
  userId: string,
  data: Partial<UserBodyInfo>,
): Promise<void> => {
  const dotted = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [`bodyInfo.${k}`, v]),
  );
  await updateDoc(userRef(userId), dotted);
};

// 설정 화면에서 자세 알림 또는 리포트 알림 토글을 껐다 켤 때 씁니다.
export const updateNotificationSettings = async (
  userId: string,
  data: Partial<UserNotificationSettings>,
): Promise<void> => {
  const dotted = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [`notificationSettings.${k}`, v]),
  );
  await updateDoc(userRef(userId), dotted);
};

// 홈 화면의 목표 설정 모달에서 목표 점수를 바꾸고 확인을 누를 때 씁니다.
export const updateTargetScore = async (userId: string, targetScore: number): Promise<void> => {
  await updateDoc(userRef(userId), { 'deviceSettings.targetScore': targetScore });
};

// 기기 설정 화면에서 영점 교정 각도를 저장할 때 씁니다.
export const updateCalibrationAngle = async (userId: string, angle: number): Promise<void> => {
  await updateDoc(userRef(userId), { 'bodyInfo.calibrationAngle': angle });
};


// ─────────────────────────────────────────────────────────────
// 향후 연동 예정 — userService에서 직접 구현하지 않는 기능들
// ─────────────────────────────────────────────────────────────
//
// [내 정보 화면]
// - 연결/비연결 상태 실시간 표시
//   → deviceService에서 실시간 기기 상태를 받아와 화면에 표시 예정
// - 배터리 상태 표시
//   → deviceService와 연결 예정
// - 홈화면 전원 관리(전원 on/off, 절전 모드)
//   → deviceService 제어 로직과 연결 예정
//
// [홈화면]
// - 실시간 자세 점수 / 각도
//   → statsService 또는 실시간 측정 로직과 연결 예정
//
// [설정 화면]
// - 알림 on/off 저장: userService (updateNotificationSettings) 가 담당
// - 실제 알림 생성 / 발송
//   → 별도 알림 서비스와 연결 예정
//
// [개인정보/보안]
// - 비밀번호 변경
//   → authService에서 처리 예정
// - 로그아웃
//   → authService에서 처리 예정
// - 회원탈퇴 (계정 삭제 + 관련 데이터 정리)
//   → authService에서 처리 예정
//
// [기록 관리]
// - 기록 초기화 (자세 통계/스냅샷 삭제)
//   → statsService에서 처리 예정
// ─────────────────────────────────────────────────────────────
