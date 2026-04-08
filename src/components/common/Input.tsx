import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  style?: ViewStyle;
  rightElement?: React.ReactNode;
  autoFocus?: boolean;
  editable?: boolean;
}

export default function Input({
  value, onChangeText, placeholder, secureTextEntry,
  keyboardType = 'default', style, rightElement, autoFocus, editable = true,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry={secureTextEntry && !show}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        editable={editable}
        autoCapitalize="none"
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShow(p => !p)} style={styles.eyeBtn}>
          <Text style={styles.eyeIcon}>{show ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      )}
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.base,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
  },
  eyeBtn: { padding: SPACING.xs },
  eyeIcon: { fontSize: 16 },
  right: { marginLeft: SPACING.sm },
});
