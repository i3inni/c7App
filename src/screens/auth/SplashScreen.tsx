import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../../constants/theme';

export default function SplashScreen() {
  const nav = useNavigation<any>();
  const scale = new Animated.Value(0.8);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => nav.replace('Login'), 2000);
    return () => clearTimeout(timer);
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
