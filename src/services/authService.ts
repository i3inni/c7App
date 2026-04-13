import { auth, db } from '../lib/firebase';

// 로그인
export const login = async (email: string, password: string) => {
  // TODO
};

// 회원가입
export const signUp = async (email: string, password: string, nickname: string) => {
  // TODO
};

// 로그아웃
export const logout = async () => {
  // TODO
};

// 아이디(이메일) 중복 확인
export const checkEmailDuplicate = async (email: string): Promise<boolean> => {
  // TODO
  return false;
};

// 비밀번호 변경
export const changePassword = async (newPassword: string) => {
  // TODO
};

// 회원 탈퇴
export const deleteAccount = async () => {
  // TODO
};
