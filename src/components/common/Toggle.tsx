import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

interface Props {
  value: boolean;
  onToggle: (v: boolean) => void;
  activeColor?: string;
  size?: 'sm' | 'md';
}

export default function Toggle({ value, onToggle, activeColor = COLORS.primary, size = 'md' }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isSmall = size === 'sm';
  const trackW = isSmall ? 44 : 51;
  const trackH = isSmall ? 26 : 31;
  const thumbSize = isSmall ? 20 : 25;
  const travel = trackW - thumbSize - 4;

  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20 }).start();
  }, [value]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, travel] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#D1D5DB', activeColor] });

  return (
    <TouchableOpacity onPress={() => onToggle(!value)} activeOpacity={0.8}>
      <Animated.View style={[styles.track, { width: trackW, height: trackH, backgroundColor: bg, borderRadius: trackH / 2 }]}>
        <Animated.View style={[styles.thumb, { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center' },
  thumb: { backgroundColor: '#fff', position: 'absolute', top: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
});
