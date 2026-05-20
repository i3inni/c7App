import React, { useEffect } from 'react';
import { StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../store';
import { ADMIN_EMAILS } from '../../constants/adminConfig';

export default function SplashScreen() {
  const nav = useNavigation();
  const setUser = useStore((s) => s.setUser);
  const logoutStore = useStore((s) => s.logout);

  useEffect(() => {
    const startedAt = Date.now();

    const goTo = (screen: string) => {
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      setTimeout(() => (nav as any).replace(screen), remaining);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();

      if (!firebaseUser) {
        goTo('Login');
        return;
      }

      // 앱 로컬 세션은 persist하지 않으므로, 재빌드/재시작 후 남아있는
      // Firebase Auth 세션만으로 메인/관리자 탭에 자동 진입하지 않게 한다.
      if (!useStore.getState().user) {
        await signOut(auth);
        logoutStore();
        goTo('Login');
        return;
      }

      if (!firebaseUser.emailVerified && !ADMIN_EMAILS.includes(firebaseUser.email ?? '')) {
        await signOut(auth);
        logoutStore();
        goTo('Login');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = snap.exists() ? snap.data() : null;
        if (data?.account?.isActive === false) {
          // 탈퇴 계정이면 로그인 화면으로 (재활성화 여부는 LoginScreen에서 처리)
          await signOut(auth);
          logoutStore();
          goTo('Login');
          return;
        }
        setUser({
          id: firebaseUser.uid,
          nickname: data?.account?.nickname ?? firebaseUser.displayName ?? '사용자',
          email: data?.account?.email ?? firebaseUser.email ?? undefined,
          height: data?.bodyInfo?.height ?? undefined,
          weight: data?.bodyInfo?.weight ?? undefined,
          sittingTime: data?.bodyInfo?.sittingTime ?? undefined,
          isGuest: false,
        });
        const hasBodyInfo = data?.bodyInfo?.height && data?.bodyInfo?.weight;
        if (!hasBodyInfo) { goTo('InitBodyInfo'); return; }
        const hasDevice = !!useStore.getState().device.deviceId;
        if (!hasDevice) { await signOut(auth); logoutStore(); goTo('Login'); return; }
        goTo('MainTabs');
      } catch {
        goTo('Login');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Image
      source={require('../../../assets/splash.png')}
      style={styles.splash}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, width: '100%', height: '100%' },
});
