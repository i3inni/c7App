import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle, Line, Text as SvgText, Path } from 'react-native-svg';
import { useStore } from '../../store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const { width } = Dimensions.get('window');

// ── 미니 라인 차트 ───────────────────────────────────
function LineChart({
  data, targetScore, width: W, height: H,
}: {
  data: { label: string; score: number }[];
  targetScore: number;
  width: number;
  height: number;
}) {
  if (data.length < 2) return null;
  const PAD = { l: 32, r: 16, t: 16, b: 24 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const minScore = Math.min(...data.map(d => d.score)) - 5;
  const maxScore = Math.max(...data.map(d => d.score)) + 5;

  const xOf = (i: number) => PAD.l + (i / (data.length - 1)) * chartW;
  const yOf = (s: number) => PAD.t + chartH - ((s - minScore) / (maxScore - minScore)) * chartH;
  const targetY = yOf(targetScore);

  const points = data.map((d, i) => `${xOf(i)},${yOf(d.score)}`).join(' ');
  const fillPath = `M ${xOf(0)} ${yOf(data[0].score)} ` +
    data.slice(1).map((d, i) => `L ${xOf(i + 1)} ${yOf(d.score)}`).join(' ') +
    ` L ${xOf(data.length - 1)} ${PAD.t + chartH} L ${xOf(0)} ${PAD.t + chartH} Z`;

  return (
    <Svg width={W} height={H}>
      {/* 목표선 */}
      <Line
        x1={PAD.l} y1={targetY} x2={W - PAD.r} y2={targetY}
        stroke={COLORS.accent} strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6}
      />

      {/* 채움 */}
      <Path d={fillPath} fill={COLORS.primary} opacity={0.08} />

      {/* 라인 */}
      <Polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* 포인트 + 레이블 */}
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xOf(i)} cy={yOf(d.score)} r={5} fill="#fff" stroke={COLORS.primary} strokeWidth={2} />
          <SvgText
            x={xOf(i)} y={H - 4} textAnchor="middle"
            fontSize={10} fill={COLORS.textSecondary}
          >
            {d.label}
          </SvgText>
          <SvgText
            x={xOf(i)} y={yOf(d.score) - 10} textAnchor="middle"
            fontSize={10} fill={COLORS.textSecondary} fontWeight="600"
          >
            {d.score}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

// ── 오늘 요약 상세 모달 ──────────────────────────────
function TodayDetailModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { todayStats } = useStore();
  if (!todayStats) return null;

  const hourlyData = [
    { label: '오전 9-12시', score: 88, color: COLORS.primary },
    { label: '오후 12-3시', score: 75, color: COLORS.scoreNormal },
    { label: '오후 3-6시', score: 82, color: COLORS.primary },
    { label: '오후 6-9시', score: 68, color: COLORS.accent },
  ];
  const badPostures = [
    { time: '14:23', angle: 22.5, min: 8, level: '위험' },
    { time: '16:45', angle: 19.2, min: 5, level: '주의' },
    { time: '18:12', angle: 23.8, min: 12, level: '위험' },
    { time: '20:05', angle: 18.1, min: 3, level: '주의' },
  ];

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={dtStyles.header}>
          <Text style={dtStyles.title}>오늘의 상세 분석</Text>
          <TouchableOpacity onPress={onClose}><Text style={dtStyles.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingBottom: 40 }}>
          {/* 총점 */}
          <View style={dtStyles.scoreCard}>
            <View>
              <Text style={dtStyles.scoreSub}>오늘의 종합 점수</Text>
              <Text style={dtStyles.scoreNum}>{todayStats.dailyScore}</Text>
              <View style={dtStyles.improveRow}>
                <View style={dtStyles.dot} />
                <Text style={dtStyles.improveText}>어제보다 +3점 향상</Text>
              </View>
            </View>
            <Text style={{ fontSize: 28 }}>📈</Text>
          </View>

          {/* 시간대별 */}
          <Text style={dtStyles.sectionTitle}>시간대별 자세 점수</Text>
          <View style={dtStyles.card}>
            {hourlyData.map((h, i) => (
              <View key={i} style={dtStyles.hourRow}>
                <Text style={dtStyles.hourLabel}>{h.label}</Text>
                <View style={dtStyles.barTrack}>
                  <View style={[dtStyles.barFill, { width: `${h.score}%`, backgroundColor: h.color }]} />
                </View>
                <Text style={[dtStyles.hourScore, { color: h.color }]}>{h.score}</Text>
              </View>
            ))}
          </View>

          {/* 불량 자세 */}
          <Text style={dtStyles.sectionTitle}>불량 자세 발생 기록</Text>
          {badPostures.map((b, i) => (
            <View key={i} style={[
              dtStyles.badCard,
              { backgroundColor: b.level === '위험' ? '#FFF0F3' : '#FFF7EC' }
            ]}>
              <View style={dtStyles.badLeft}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>⏰</Text>
                <Text style={[dtStyles.badTime, { color: b.level === '위험' ? COLORS.accent : COLORS.warning }]}>
                  {b.time}
                </Text>
              </View>
              <Text style={dtStyles.badDetail}>각도: {b.angle}°    지속시간: {b.min}분</Text>
              <View style={[dtStyles.levelBadge, { backgroundColor: b.level === '위험' ? COLORS.accent : COLORS.warning }]}>
                <Text style={dtStyles.levelText}>{b.level}</Text>
              </View>
            </View>
          ))}

          {/* 활동 요약 */}
          <Text style={dtStyles.sectionTitle}>활동 요약</Text>
          <View style={dtStyles.summaryGrid}>
            {[
              { icon: '📈', label: '교정 횟수', val: `${todayStats.badPostureCount * 3}회` },
              { icon: '⏰', label: '바른 자세 유지', val: `${todayStats.totalUsageTime}h` },
              { icon: '🔴', label: '평균 각도', val: `${todayStats.avgAngle}°` },
              { icon: '⚡', label: '진동 알림', val: `${todayStats.vibrationCount}회` },
            ].map((s, i) => (
              <View key={i} style={dtStyles.summaryCard}>
                <Text style={dtStyles.summaryIcon}>{s.icon}</Text>
                <Text style={dtStyles.summaryLabel}>{s.label}</Text>
                <Text style={dtStyles.summaryVal}>{s.val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const dtStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  close: { fontSize: 20, color: COLORS.textSecondary },
  scoreCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#2D7A3A', borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.base,
  },
  scoreSub: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreNum: { fontSize: FONTS.sizes['4xl'], fontWeight: '900', color: '#fff' },
  improveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7EE8A2', marginRight: 5 },
  improveText: { fontSize: FONTS.sizes.xs, color: '#7EE8A2', fontWeight: '600' },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.base, ...SHADOWS.sm, marginBottom: SPACING.sm },
  hourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  hourLabel: { width: 100, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  barTrack: { flex: 1, height: 6, backgroundColor: COLORS.bgSecondary, borderRadius: 3, marginHorizontal: SPACING.sm, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  hourScore: { width: 28, fontSize: FONTS.sizes.sm, fontWeight: '700', textAlign: 'right' },
  badCard: { borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  badLeft: { flexDirection: 'row', alignItems: 'center' },
  badTime: { fontSize: FONTS.sizes.md, fontWeight: '700' },
  badDetail: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 4 },
  levelBadge: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  levelText: { fontSize: FONTS.sizes.xs, color: '#fff', fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  summaryCard: {
    width: (width - SPACING.base * 2 - SPACING.sm) / 2 - 1,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.base,
    alignItems: 'center', ...SHADOWS.sm,
  },
  summaryIcon: { fontSize: 24, marginBottom: SPACING.xs },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, textAlign: 'center' },
  summaryVal: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: 4 },
});

// ── 주간 상세 모달 ────────────────────────────────────
function WeekDetailModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const days = [
    { day: '월요일', date: '3/17', score: 68, diff: -2, level: '주의', color: COLORS.accent },
    { day: '화요일', date: '3/18', score: 73, diff: +5, level: '보통', color: COLORS.scoreNormal },
    { day: '수요일', date: '3/19', score: 71, diff: -2, level: '보통', color: COLORS.scoreNormal },
    { day: '목요일', date: '3/20', score: 65, diff: -6, level: '주의', color: COLORS.accent },
    { day: '금요일', date: '3/21', score: 92, diff: +27, level: '우수', color: COLORS.primary, best: true },
    { day: '토요일', date: '3/22', score: 85, diff: -7, level: '양호', color: COLORS.scoreGood },
    { day: '일요일', date: '3/23', score: 88, diff: +3, level: '양호', color: COLORS.scoreGood },
  ];

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={dtStyles.header}>
          <Text style={dtStyles.title}>주간 상세 분석</Text>
          <TouchableOpacity onPress={onClose}><Text style={dtStyles.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingBottom: 40 }}>
          {/* 평균 */}
          <View style={[dtStyles.scoreCard, { backgroundColor: '#B45309' }]}>
            <View>
              <Text style={dtStyles.scoreSub}>이번 주 평균 점수</Text>
              <Text style={dtStyles.scoreNum}>77.4</Text>
              <View style={dtStyles.improveRow}>
                <Text style={{ fontSize: 12, color: '#FCD34D' }}>↗ 지난주 대비 +5.2점</Text>
              </View>
            </View>
            <Text style={{ fontSize: 28 }}>📊</Text>
          </View>

          <Text style={dtStyles.sectionTitle}>요일별 상세 점수</Text>
          {days.map((d, i) => (
            <View key={i} style={[wkStyles.dayRow, d.score < 70 && wkStyles.dayRowBad]}>
              <View style={[wkStyles.scoreBadge, { backgroundColor: d.color }]}>
                <Text style={wkStyles.scoreBadgeText}>{d.score}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={wkStyles.dayName}>{d.day}</Text>
                  {d.best && <View style={wkStyles.bestBadge}><Text style={wkStyles.bestText}>최고</Text></View>}
                </View>
                <Text style={wkStyles.dateText}>{d.date}</Text>
                <View style={[wkStyles.barTrack, { marginTop: 6 }]}>
                  <View style={[wkStyles.barFill, { width: `${d.score}%`, backgroundColor: d.color }]} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: FONTS.sizes.sm, color: d.diff > 0 ? COLORS.primary : COLORS.accent, fontWeight: '700' }}>
                  {d.diff > 0 ? '↗' : '↘'} {d.diff > 0 ? '+' : ''}{d.diff}
                </Text>
                <Text style={[wkStyles.levelText2, { color: d.color }]}>{d.level}</Text>
              </View>
            </View>
          ))}

          <Text style={dtStyles.sectionTitle}>주간 통계</Text>
          <View style={dtStyles.summaryGrid}>
            {[
              { icon: '🎯', label: '목표 달성일', val: '3 / 7일' },
              { icon: '⏰', label: '평균 각도', val: '16.8°' },
              { icon: '⚡', label: '총 진동 알림', val: '42회' },
              { icon: '🔴', label: '불량 자세', val: '28회' },
            ].map((s, i) => (
              <View key={i} style={dtStyles.summaryCard}>
                <Text style={dtStyles.summaryIcon}>{s.icon}</Text>
                <Text style={dtStyles.summaryLabel}>{s.label}</Text>
                <Text style={dtStyles.summaryVal}>{s.val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const wkStyles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  dayRowBad: { backgroundColor: '#FFF5F5' },
  scoreBadge: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreBadgeText: { fontSize: FONTS.sizes.base, fontWeight: '800', color: '#fff' },
  dayName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  barTrack: { height: 4, backgroundColor: COLORS.bgSecondary, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  levelText2: { fontSize: FONTS.sizes.xs, fontWeight: '700', marginTop: 2 },
  bestBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  bestText: { fontSize: 9, color: '#fff', fontWeight: '700' },
});

// ── 메인 STATS 화면 ──────────────────────────────────
export default function StatsScreen() {
  const { todayStats, weeklyStats, settings } = useStore();
  const [tab, setTab] = useState<'weekly' | 'monthly'>('monthly');
  const [showTodayDetail, setShowTodayDetail] = useState(false);
  const [showWeekDetail, setShowWeekDetail] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  const chartData = weeklyStats.map(w => ({ label: w.weekLabel, score: w.avgScore }));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity><Text style={s.menuIcon}>☰</Text></TouchableOpacity>
        <Text style={s.pageTitle}>활동 기록</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.base, paddingBottom: 32 }}>
        {/* 오늘 요약 */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>오늘의 요약</Text>
          <View style={s.streakBadge}>
            <View style={s.streakDot} />
            <Text style={s.streakText}>7일 연속 달성</Text>
          </View>
        </View>

        <View style={s.todayCard}>
          <View style={s.todayScoreRow}>
            <View style={s.todayIconBox}>
              <Text style={s.todayIcon}>◉</Text>
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={s.todayScoreSub}>오늘 점수</Text>
              <Text style={s.todayScoreNum}>{todayStats?.dailyScore ?? '--'}</Text>
            </View>
            <View style={s.goodBadge}>
              <View style={s.goodDot} />
              <Text style={s.goodText}>양호</Text>
            </View>
          </View>

          <View style={s.todayMiniRow}>
            <View style={s.todayMiniBox}>
              <View style={[s.miniIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={s.miniIcon}>⚠️</Text>
              </View>
              <View>
                <Text style={s.miniLabel}>불량 자세</Text>
                <Text style={s.miniVal}>{todayStats?.badPostureCount ?? 0}<Text style={s.miniUnit}> 회</Text></Text>
              </View>
            </View>
            <View style={s.todayMiniBox}>
              <View style={[s.miniIconCircle, { backgroundColor: '#D1FAE5' }]}>
                <Text style={s.miniIcon}>⏰</Text>
              </View>
              <View>
                <Text style={s.miniLabel}>교정 시간</Text>
                <Text style={s.miniVal}>{todayStats?.correctionCount ?? 0}<Text style={s.miniUnit}> 회</Text></Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.moreBtn} onPress={() => setShowTodayDetail(true)}>
            <Text style={s.moreBtnText}>더 보기  ›</Text>
          </TouchableOpacity>
        </View>

        {/* 자세 측정 지표 */}
        <View style={[s.sectionHeader, { marginTop: SPACING.lg }]}>
          <Text style={s.sectionTitle}>자세 측정 지표</Text>
          <Text style={s.targetLabel}>— 목표 {settings.targetScore}</Text>
        </View>

        <View style={s.chartCard}>
          {/* 탭 */}
          <View style={s.tabRow}>
            {(['weekly', 'monthly'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'weekly' ? '주간' : '월간'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 차트 */}
          <View style={{ marginTop: SPACING.sm }}>
            <Text style={s.chartSub}>평균 점수의 주별 추이</Text>
            <LineChart
              data={chartData}
              targetScore={settings.targetScore}
              width={width - SPACING.base * 4}
              height={160}
            />
          </View>

          {/* 월 네비게이션 */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => setMonthOffset(p => p + 1)}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.monthLabel}>{Math.abs(monthOffset)}개월 전</Text>
              <Text style={s.monthSub}>2024년 3월</Text>
            </View>
            <TouchableOpacity onPress={() => setMonthOffset(p => Math.max(0, p - 1))}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setShowWeekDetail(true)} style={s.weekMoreBtn}>
            <Text style={s.moreBtnText}>자세 측정 지표 더보기  ›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TodayDetailModal visible={showTodayDetail} onClose={() => setShowTodayDetail(false)} />
      <WeekDetailModal visible={showWeekDetail} onClose={() => setShowWeekDetail(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  menuIcon: { fontSize: 22, color: COLORS.text },
  pageTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  streakText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  targetLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  todayCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.md },
  todayScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.base },
  todayIconBox: {
    width: 48, height: 48, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  todayIcon: { fontSize: 22, color: '#fff' },
  todayScoreSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  todayScoreNum: { fontSize: FONTS.sizes['3xl'], fontWeight: '800', color: COLORS.text },
  goodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goodDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  goodText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },

  todayMiniRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  todayMiniBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  miniIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  miniIcon: { fontSize: 16 },
  miniLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 2 },
  miniVal: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  miniUnit: { fontSize: FONTS.sizes.sm, fontWeight: '400', color: COLORS.textSecondary },

  moreBtn: { alignSelf: 'center', paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  moreBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  weekMoreBtn: { alignSelf: 'center', marginTop: SPACING.sm, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },

  chartCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.sm },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.full, padding: 3 },
  tabBtn: { flex: 1, height: 36, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  chartSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.xs },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  navArrow: { fontSize: 22, color: COLORS.textSecondary, padding: SPACING.sm },
  monthLabel: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  monthSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
});
