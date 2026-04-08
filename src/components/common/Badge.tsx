import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

type Variant = 'danger' | 'warning' | 'success' | 'info' | 'neutral';

interface Props {
  label: string;
  variant?: Variant;
}

const BG: Record<Variant, string> = {
  danger: '#FFF0F3',
  warning: '#FFF7EC',
  success: '#E8F8F3',
  info: '#EFF6FF',
  neutral: '#F3F4F6',
};
const TEXT: Record<Variant, string> = {
  danger: COLORS.accent,
  warning: COLORS.warning,
  success: COLORS.primary,
  info: COLORS.info,
  neutral: COLORS.textSecondary,
};

export default function Badge({ label, variant = 'neutral' }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[variant] }]}>
      <Text style={[styles.text, { color: TEXT[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  text: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
});
