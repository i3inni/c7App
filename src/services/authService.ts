import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { auth, db } from '../lib/firebase';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// ─── 이메일/비밀번호 로그인 ───────────────────────────────────────────────────
// Firebase에 이메일+비번을 보내서 인증 → 성공하면 user 객체 반환
export const login = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user; // result.user.uid, result.user.email 등 사용 가능
};

// ─── 이메일/비밀번호 회원가입 ─────────────────────────────────────────────────
// 1. Firebase Auth에 계정 생성
// 2. Firestore DB에 유저 프로필 문서 저장
export const signUp = async (email: string, password: string, nickname: string) => {
  // Firebase Auth 계정 생성
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Firestore에 유저 프로필 저장
  // users/{userId} 경로에 문서 생성
  await setDoc(doc(db, 'users', user.uid), {
    nickname,
    email,
    isGuest: false,
    createdAt: Date.now(),
  });

  return user;
};

// ─── 구글 로그인 ──────────────────────────────────────────────────────────────
// 1. 구글 로그인 팝업 → idToken 받아옴
// 2. idToken으로 Firebase 인증
// 3. 신규 유저면 Firestore에 프로필 자동 생성
export const loginWithGoogle = async () => {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  console.log('Google response:', JSON.stringify(response));
  console.log('webClientId:', GOOGLE_WEB_CLIENT_ID);

  if (response.type !== 'success') throw new Error('Google 로그인 취소됨');
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google idToken을 받지 못했습니다.');

  // 구글 토큰 → Firebase 인증 정보로 변환
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  const user = result.user;

  // 신규 유저면 Firestore에 프로필 생성
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      nickname: user.displayName ?? '사용자',
      email: user.email,
      isGuest: false,
      createdAt: Date.now(),
    });
  }

  return user;
};

// // ─── 애플 로그인 (iOS 전용) ───────────────────────────────────────────────────
// // 1. 애플 로그인 팝업 → credential 받아옴
// // 2. Firebase 인증
// // 3. 신규 유저면 Firestore에 프로필 자동 생성
// export const loginWithApple = async () => {
//   const appleCredential = await AppleAuthentication.signInAsync({
//     requestedScopes: [
//       AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
//       AppleAuthentication.AppleAuthenticationScope.EMAIL,
//     ],
//   });

//   // 애플 credential → Firebase 인증 정보로 변환
//   const provider = new OAuthProvider('apple.com');
//   const credential = provider.credential({
//     idToken: appleCredential.identityToken!,
//     rawNonce: appleCredential.authorizationCode!,
//   });

//   const result = await signInWithCredential(auth, credential);
//   const user = result.user;

//   // 신규 유저면 Firestore에 프로필 생성
//   const userDoc = await getDoc(doc(db, 'users', user.uid));
//   if (!userDoc.exists()) {
//     const fullName = appleCredential.fullName;
//     const nickname = fullName?.givenName ?? '사용자';
//     await setDoc(doc(db, 'users', user.uid), {
//       nickname,
//       email: user.email,
//       isGuest: false,
//       createdAt: Date.now(),
//     });
//   }

//   return user;
// };

// ─── 로그아웃 ─────────────────────────────────────────────────────────────────
export const logout = async () => {
  await signOut(auth);
};

// ─── 이메일 중복 확인 ─────────────────────────────────────────────────────────
// Firestore users 컬렉션에서 해당 이메일 조회
// true = 이미 사용 중, false = 사용 가능
export const checkEmailDuplicate = async (email: string): Promise<boolean> => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

// ─── 비밀번호 변경 ────────────────────────────────────────────────────────────
// Firebase는 보안상 비밀번호 변경 전 재인증 필요
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('로그인 상태가 아닙니다.');

  // 현재 비밀번호로 재인증
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // 새 비밀번호로 변경
  await updatePassword(user, newPassword);
};

// ─── 회원 탈퇴 ────────────────────────────────────────────────────────────────
export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');
  await deleteUser(user);
};
