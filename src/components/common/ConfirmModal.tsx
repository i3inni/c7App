import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING, SHADOWS } from '../../constants/theme';

interface Props {
  visible: boolean;
  icon?: React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'dark';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible, icon, title, message,
  confirmLabel = '확인', cancelLabel = '취소',
  confirmVariant = 'primary',
  onConfirm, onCancel,
}: Props) {
  const confirmBg =
    confirmVariant === 'danger' ? COLORS.accent :
    confirmVariant === 'dark' ? COLORS.bgDark : COLORS.primary;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          {icon ? (
            <View style={styles.iconWrap}>{icon}</View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: confirmBg }]} onPress={onConfirm}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  box: {
    width: 320, backgroundColor: '#fff',
    borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', ...SHADOWS.lg,
  },
  iconWrap: {
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.base,
  },
  title: {
    fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold,
    color: COLORS.text, marginBottom: SPACING.sm, textAlign: 'center',
  },
  message: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: SPACING.lg,
  },
  row: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.medium, color: COLORS.text },
  confirmBtn: {
    flex: 1, height: 48, borderRadius: RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.bold, color: '#fff' },
});
