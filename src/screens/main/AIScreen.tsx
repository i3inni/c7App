import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type Step = 1 | 2 | 3;

const EXERCISES: Record<Step, {
  badge: string; title: string; desc: string;
  reps: string; tip: string; color: string;
}> = {
  1: {
    badge: 'STEP 1',
    title: '목 뒤 스트레칭',
    desc: '양손을 깍지 껴 머리 뒤에 대고 천천히 앞으로 당겨주세요. 목 뒤쪽 근육이 늘어나는 느낌이 들면 15초간 유지합니다.',
    reps: '15초 × 3회',
    tip: '호흡을 천천히 하면서 무리하지 않게 진행하세요.',
    color: COLORS.step1,
  },
  2: {
    badge: 'STEP 2',
    title: '어깨 으쓱 운동',
    desc: '어깨를 귀 쪽으로 최대한 올리고 5초간 유지한 후 천천히 내려주세요. 어깨와 목 주변 긴장을 풀어줍니다.',
    reps: '5초 × 10회',
    tip: '내릴 때는 힘을 빼고 자연스럽게 떨어뜨리세요.',
    color: COLORS.step2,
  },
  3: {
    badge: 'STEP 3',
    title: '턱 당기기 운동',
    desc: '정면을 바라본 상태에서 턱을 뒤로 당겨 이중턱을 만들듯이 합니다. 목을 곧게 펴는 효과가 있습니다.',
    reps: '10초 × 5회',
    tip: '거울을 보며 정확한 자세를 확인하세요.',
    color: COLORS.step3,
  },
};

export default function AIScreen() {
  const nav = useNavigation();
  const { currentAngle, currentScore } = useStore();
  const [activeStep, setActiveStep] = useState<Step>(1);

  const ex = EXERCISES[activeStep];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 헤더 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>거북목 진단사</Text>
        </View>

        {/* AI 카드 */}
        <View style={styles.aiCard}>
          <View style={styles.aiIconBox}>
            <Text style={styles.aiIcon}>🩺</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.aiTitleRow}>
              <Text style={styles.aiTitle}>목 건강 지도사</Text>
              <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
            </View>
            <Text style={styles.aiDesc}>AI 기반 맞춤형 거북목 진단 및 교정 전문가입니다</Text>
          </View>
        </View>

        {/* 오늘의 진단 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📋</Text>
            <Text style={styles.sectionTitle}>오늘의 진단 결과</Text>
          </View>

          <View style={styles.diagCard}>
            <View style={styles.diagTop}>
              <Text style={styles.diagWarningIcon}>⚠️</Text>
              <Text style={styles.diagTitle}>중등도 거북목</Text>
              <View style={styles.cautionBadge}><Text style={styles.cautionText}>주의</Text></View>
            </View>
            <Text style={styles.diagDesc}>
              현재 목 각도 {currentAngle}°로 정상 범위(5-15°)를 벗어났습니다.
              장시간 같은 자세 유지 시 통증이 발생할 수 있습니다.
            </Text>
            <View style={styles.diagStats}>
              <View style={styles.diagStat}>
                <Text style={styles.diagStatLabel}>현재 각도</Text>
                <Text style={[styles.diagStatVal, { color: COLORS.warning }]}>{currentAngle}°</Text>
              </View>
              <View style={styles.diagStat}>
                <Text style={styles.diagStatLabel}>정상 범위</Text>
                <Text style={styles.diagStatVal}>5-15°</Text>
              </View>
              <View style={styles.diagStat}>
                <Text style={styles.diagStatLabel}>개선율</Text>
                <Text style={[styles.diagStatVal, { color: COLORS.primary }]}>+12%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 단계별 솔루션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>💡</Text>
            <Text style={styles.sectionTitle}>단계별 솔루션</Text>
          </View>

          {/* 스텝 탭 */}
          <View style={styles.stepRow}>
            {([1, 2, 3] as Step[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.stepTab,
                  activeStep === s && { backgroundColor: EXERCISES[s].color },
                ]}
                onPress={() => setActiveStep(s)}
              >
                <Text style={[styles.stepTabText, activeStep === s && styles.stepTabTextActive]}>
                  {s}단계
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 운동 카드 */}
          <View style={[styles.exCard, { borderLeftColor: ex.color, borderLeftWidth: 3 }]}>
            <View style={styles.exTop}>
              <Text style={styles.exActivityIcon}>📈</Text>
              <View style={[styles.exBadge, { backgroundColor: ex.color }]}>
                <Text style={styles.exBadgeText}>{ex.badge}</Text>
              </View>
              <Text style={styles.exTitle}>{ex.title}</Text>
            </View>
            <Text style={styles.exDesc}>{ex.desc}</Text>
            <View style={styles.exRepsRow}>
              <Text style={styles.repsLabel}>권장 횟수</Text>
              <Text style={[styles.repsVal, { color: ex.color }]}>{ex.reps}</Text>
            </View>
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 Tip: {ex.tip}</Text>
            </View>
          </View>
        </View>

        {/* 주간 건강 리포트 */}
        <View style={[styles.section, { paddingHorizontal: SPACING.base }]}>
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.reportIconBox}>
                <Text style={styles.reportIcon}>🛡️</Text>
              </View>
              <View>
                <Text style={styles.reportTitle}>주간 건강 리포트</Text>
                <Text style={styles.reportSub}>Based on 7 days monitoring</Text>
              </View>
            </View>
            <Text style={styles.reportBody}>
              지난주 대비 평균 자세 점수가{' '}
              <Text style={{ color: COLORS.scoreExcellent, fontWeight: '700' }}>8.2점 상승</Text>
              했습니다. 목요일 오전 시간대에 가장 좋은 자세를 유지하셨어요.
              꾸준한 개선이 관찰되고 있으니 이대로 유지해주세요!
            </Text>
            <View style={styles.reportStats}>
              <View style={styles.reportStat}>
                <Text style={styles.reportStatLabel}>Best Score</Text>
                <Text style={styles.reportStatVal}>92점</Text>
              </View>
              <View style={styles.reportStat}>
                <Text style={styles.reportStatLabel}>개선 추세</Text>
                <Text style={[styles.reportStatVal, { color: COLORS.scoreExcellent }]}>↑ 15%</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },
  backIcon: { fontSize: 22, color: COLORS.text },
  pageTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },

  aiCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: SPACING.base,
    borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.sm, ...SHADOWS.sm,
    marginBottom: SPACING.base,
  },
  aiIconBox: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  aiIcon: { fontSize: 24 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  aiTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  aiBadge: { backgroundColor: COLORS.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  aiBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  aiDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },

  section: { paddingHorizontal: SPACING.base, marginBottom: SPACING.base },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },

  diagCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.sm },
  diagTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  diagWarningIcon: { fontSize: 18 },
  diagTitle: { flex: 1, fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  cautionBadge: { backgroundColor: '#FFF7EC', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  cautionText: { fontSize: FONTS.sizes.xs, color: COLORS.warning, fontWeight: '700' },
  diagDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.base },
  diagStats: { flexDirection: 'row', justifyContent: 'space-around' },
  diagStat: { alignItems: 'center' },
  diagStatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 4 },
  diagStatVal: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text },

  stepRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  stepTab: {
    flex: 1, height: 38, borderRadius: RADIUS.full,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },
  stepTabText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  stepTabTextActive: { color: '#fff' },

  exCard: {
    backgroundColor: '#F8FAFF', borderRadius: RADIUS.xl,
    padding: SPACING.base, ...SHADOWS.sm,
  },
  exTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  exActivityIcon: { fontSize: 18 },
  exBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  exBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  exTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  exDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.base },
  exRepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  repsLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  repsVal: { fontSize: FONTS.sizes.sm, fontWeight: '700' },
  tipBox: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: RADIUS.sm, padding: SPACING.sm },
  tipText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  reportCard: {
    backgroundColor: COLORS.bgDark, borderRadius: RADIUS.xl, padding: SPACING.lg,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.base },
  reportIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  reportIcon: { fontSize: 18 },
  reportTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: '#fff' },
  reportSub: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.4)' },
  reportBody: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: SPACING.base },
  reportStats: { flexDirection: 'row', gap: SPACING.lg },
  reportStat: {},
  reportStatLabel: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.4)' },
  reportStatVal: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: '#fff', marginTop: 4 },
});
