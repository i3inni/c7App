import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import Button from '../../components/common/Button';
import { updateBodyInfo } from '../../services/userService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export default function InitBodyInfoScreen() {
  const nav = useNavigation();
  const { user, updateUser } = useStore();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const h = Number(height);
    const w = Number(weight);
    if (!h || !w || h < 50 || h > 250 || w < 10 || w > 300) {
      Alert.alert('입력 오류', '키와 체중을 올바르게 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (user?.id && user.id !== 'guest') {
        await updateBodyInfo(user.id, { height: h, weight: w });
      }
      updateUser({ height: h, weight: w });
      (nav as any).replace('MainTabs');
    } catch {
      Alert.alert('저장 실패', '정보를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    (nav as any).replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Text style={styles.title}>신체 정보를 입력해주세요</Text>
          <Text style={styles.subtitle}>
            자세 분석과 목표 설정에 활용됩니다.{'\n'}나중에 내 정보에서 변경할 수 있어요.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>키</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                placeholder="예) 170"
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>체중</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="예) 65"
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>
        </View>

        <Button
          label="저장하고 시작하기"
          onPress={handleSave}
          disabled={!height || !weight || loading}
          style={{ marginTop: SPACING.lg }}
        />
        <Button
          label="나중에 입력하기"
          onPress={handleSkip}
          variant="secondary"
          style={{ marginTop: SPACING.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xl * 2 },
  topSection: { marginBottom: SPACING.xl },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  fieldWrap: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: SPACING.xs,
  },
  unit: {
    fontSize: FONTS.sizes.base,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.bgSecondary,
    marginHorizontal: SPACING.lg,
  },
});
