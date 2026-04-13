import { auth, db } from '../lib/firebase';
import { User, AppSettings } from '../constants/types';

// 유저 프로필 저장 (회원가입 시)
export const createUserProfile = async (userId: string, data: Partial<User>) => {
  // TODO
};

// 유저 프로필 조회
export const getUserProfile = async (userId: string): Promise<User | null> => {
  // TODO
  return null;
};

// 유저 프로필 수정 (닉네임, 신체정보 등)
export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  // TODO
};

// 앱 설정 저장 (알림, 목표점수 등)
export const updateUserSettings = async (userId: string, settings: Partial<AppSettings>) => {
  // TODO
};

// 앱 설정 조회
export const getUserSettings = async (userId: string): Promise<AppSettings | null> => {
  // TODO
  return null;
};
