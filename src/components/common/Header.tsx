import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
}

export default function Header({ title, subtitle, showBack = true, rightIcon, onRightPress }: Props) {
  const nav = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.iconBtn, !showBack && styles.invisible]}
        onPress={() => nav.goBack()}
        disabled={!showBack}
      >
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.iconBtn, !rightIcon && styles.invisible]}
        onPress={onRightPress}
        disabled={!rightIcon}
      >
        <Text style={styles.rightIcon}>{rightIcon}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  invisible: { opacity: 0 },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1 },
  backIcon: { fontSize: 22, color: COLORS.text, marginTop: -2 },
  rightIcon: { fontSize: 18 },
});
