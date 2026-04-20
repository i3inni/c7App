import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../store';
import { COLORS, FONTS } from '../../constants/theme';

export default function SplashScreen() {
  const nav = useNavigation();
  const setUser = useStore((s) => s.setUser);
  const scale = new Animated.Value(0.8);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    const startedAt = Date.now();

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

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

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = snap.exists() ? snap.data() : null;
        setUser({
          id: firebaseUser.uid,
          nickname: data?.nickname ?? firebaseUser.displayName ?? '사용자',
          email: data?.email ?? firebaseUser.email ?? undefined,
          isGuest: false,
        });
        goTo('MainTabs');
      } catch {
        goTo('Login');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚡</Text>
        </View>
        <Text style={styles.appName}>C7 AI</Text>
        <Text style={styles.tagline}>Smart Posture Intelligence</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center' },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFE8ED',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 36 },
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.text, fontStyle: 'italic' },
  tagline: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 6 },
});
