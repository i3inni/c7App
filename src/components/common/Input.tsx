import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
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

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#8A9BB5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="#8A9BB5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="#8A9BB5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="#8A9BB5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="1" y1="1" x2="23" y2="23" stroke="#8A9BB5" strokeWidth={1.8} strokeLinecap="round" />
      </>
    )}
  </Svg>
);

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
          <EyeIcon visible={show} />
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
    backgroundColor: '#F7F8FA',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.base,
    height: 52,
    borderWidth: 1,
    borderColor: '#E8ECF1',
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
  },
  eyeBtn: { padding: SPACING.xs },
  right: { marginLeft: SPACING.sm },
});
