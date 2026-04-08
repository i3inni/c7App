import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'kakao' | 'ghost' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  rightIcon?: string;
}

export default function Button({
  label, onPress, variant = 'primary',
  disabled, loading, style, textStyle, rightIcon,
}: Props) {
  const btnStyle = [
    styles.base,
    styles[variant],
    disabled && styles.disabled,
    style,
  ];
  const txtStyle = [styles.text, styles[`${variant}Text` as keyof typeof styles], textStyle];

  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? COLORS.primary : '#fff'} />
      ) : (
        <Text style={txtStyle}>
          {label}{rightIcon ? `  ${rightIcon}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.bgSecondary },
  danger: { backgroundColor: COLORS.accent },
  kakao: { backgroundColor: COLORS.kakao },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  dark: { backgroundColor: COLORS.bgDark },
  disabled: { opacity: 0.4 },

  text: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.bold },
  primaryText: { color: '#fff' },
  secondaryText: { color: COLORS.text },
  dangerText: { color: '#fff' },
  kakaoText: { color: COLORS.text },
  ghostText: { color: COLORS.text },
  darkText: { color: '#fff' },
});
