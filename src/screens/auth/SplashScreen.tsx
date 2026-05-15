import React, { useEffect } from 'react';
import { StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../store';

export default function SplashScreen() {
  const nav = useNavigation();
  const setUser = useStore((s) => s.setUser);

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

      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        goTo('Login');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = snap.exists() ? snap.data() : null;
        if (data?.account?.isActive === false) {
          // 탈퇴 계정이면 로그인 화면으로 (재활성화 여부는 LoginScreen에서 처리)
          await signOut(auth);
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
        if (!hasDevice) { await signOut(auth); goTo('Login'); return; }
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
