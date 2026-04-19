import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle, Line, Text as SvgText, Path } from 'react-native-svg';
import { useStore } from '../../store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getTodayStats, getWeeklyStats, getSnapshots } from '../../services/statsService';
import { PostureSnapshot } from '../../constants/types';

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
      <Line
        x1={PAD.l} y1={targetY} x2={W - PAD.r} y2={targetY}
        stroke={COLORS.accent} strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6}
      />
      <Path d={fillPath} fill={COLORS.primary} opacity={0.08} />
      <Polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xOf(i)} cy={yOf(d.score)} r={5} fill="#fff" stroke={COLORS.primary} strokeWidth={2} />
          <SvgText x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={10} fill={COLORS.textSecondary}>
            {d.label}
          </SvgText>
          <SvgText x={xOf(i)} y={yOf(d.score) - 10} textAnchor="middle" fontSize={10} fill={COLORS.textSecondary} fontWeight="600">
            {d.score}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

// ── 오늘 요약 상세 모달 ──────────────────────────────
function TodayDetailModal({
  visible, onClose, snapshots,
}: {
  visible: boolean;
  onClose: () => void;
  snapshots: PostureSnapshot[];
}) {
  const { todayStats } = useStore();
  if (!todayStats) return null;

  const badPostures = snapshots.filter(s => s.level === 'caution' || s.level === 'danger').slice(0, 10);

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
                <Text style={dtStyles.improveText}>평균 각도 {todayStats.avgAngle}°</Text>
              </View>
            </View>
            <Text style={{ fontSize: 28 }}>📈</Text>
          </View>

          {/* 불량 자세 */}
          <Text style={dtStyles.sectionTitle}>불량 자세 발생 기록</Text>
          {badPostures.length === 0 ? (
            <View style={dtStyles.emptyBox}>
              <Text style={dtStyles.emptyText}>오늘 불량 자세 기록이 없습니다 👍</Text>
            </View>
          ) : (
            badPostures.map((b, i) => {
              const isDanger = b.level === 'danger';
              const time = new Date(b.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              return (
                <View key={i} style={[dtStyles.badCard, { backgroundColor: isDanger ? '#FFF0F3' : '#FFF7EC' }]}>
                  <View style={dtStyles.badLeft}>
                    <Text style={{ fontSize: 14, marginRight: 6 }}>⏰</Text>
                    <Text style={[dtStyles.badTime, { color: isDanger ? COLORS.accent : COLORS.warning }]}>{time}</Text>
                  </View>
                  <Text style={dtStyles.badDetail}>각도: {b.angle}°    지속시간: {b.durationMin}분</Text>
                  <View style={[dtStyles.levelBadge, { backgroundColor: isDanger ? COLORS.accent : COLORS.warning }]}>
                    <Text style={dtStyles.levelText}>{isDanger ? '위험' : '주의'}</Text>
                  </View>
                </View>
              );
            })
          )}

          {/* 활동 요약 */}
          <Text style={dtStyles.sectionTitle}>활동 요약</Text>
          <View style={dtStyles.summaryGrid}>
            {[
              { icon: '📈', label: '교정 횟수', val: `${todayStats.correctionCount}회` },
              { icon: '⏰', label: '사용 시간', val: `${todayStats.totalUsageTime}h` },
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
  emptyBox: { backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.md, padding: SPACING.base, alignItems: 'center' },
  emptyText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.base, ...SHADOWS.sm, marginBottom: SPACING.sm },
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
  const { weeklyStats } = useStore();

  const avgScore = weeklyStats.length > 0
    ? (weeklyStats.reduce((s, w) => s + w.avgScore, 0) / weeklyStats.length).toFixed(1)
    : '--';
  const latestChange = weeklyStats.length >= 2
    ? weeklyStats[weeklyStats.length - 1].avgScore - weeklyStats[weeklyStats.length - 2].avgScore
    : 0;

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
              <Text style={dtStyles.scoreSub}>최근 5주 평균 점수</Text>
              <Text style={dtStyles.scoreNum}>{avgScore}</Text>
              <View style={dtStyles.improveRow}>
                <Text style={{ fontSize: 12, color: '#FCD34D' }}>
                  {latestChange >= 0 ? `↗ 지난주 대비 +${latestChange}점` : `↘ 지난주 대비 ${latestChange}점`}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 28 }}>📊</Text>
          </View>

          <Text style={dtStyles.sectionTitle}>주차별 점수</Text>
          {weeklyStats.length === 0 ? (
            <View style={dtStyles.emptyBox}>
              <Text style={dtStyles.emptyText}>주간 데이터가 없습니다</Text>
            </View>
          ) : (
            weeklyStats.map((w, i) => {
              const scoreColor = w.avgScore >= 85 ? COLORS.primary : w.avgScore >= 70 ? COLORS.scoreNormal : COLORS.accent;
              const isLast = i === weeklyStats.length - 1;
              return (
                <View key={i} style={[wkStyles.dayRow, w.avgScore < 70 && wkStyles.dayRowBad]}>
                  <View style={[wkStyles.scoreBadge, { backgroundColor: scoreColor }]}>
                    <Text style={wkStyles.scoreBadgeText}>{w.avgScore}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={wkStyles.dayName}>{w.weekLabel}</Text>
                      {isLast && <View style={wkStyles.bestBadge}><Text style={wkStyles.bestText}>이번 주</Text></View>}
                    </View>
                    <View style={[wkStyles.barTrack, { marginTop: 6 }]}>
                      <View style={[wkStyles.barFill, { width: `${w.avgScore}%`, backgroundColor: scoreColor }]} />
                    </View>
                  </View>
                  {w.scoreChange !== undefined && (
                    <Text style={{ fontSize: FONTS.sizes.sm, color: w.scoreChange >= 0 ? COLORS.primary : COLORS.accent, fontWeight: '700' }}>
                      {w.scoreChange >= 0 ? `+${w.scoreChange}` : `${w.scoreChange}`}
                    </Text>
                  )}
                </View>
              );
            })
          )}
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
  barTrack: { height: 4, backgroundColor: COLORS.bgSecondary, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  bestBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  bestText: { fontSize: 9, color: '#fff', fontWeight: '700' },
});

// ── 레벨 텍스트 ───────────────────────────────────────
function scoreToLabel(score: number): string {
  if (score >= 90) return '우수';
  if (score >= 80) return '양호';
  if (score >= 70) return '보통';
  if (score >= 60) return '주의';
  return '위험';
}

function scoreToBadgeColor(score: number): string {
  if (score >= 90) return COLORS.primary;
  if (score >= 80) return COLORS.scoreGood;
  if (score >= 70) return COLORS.scoreNormal;
  return COLORS.accent;
}

// ── 메인 STATS 화면 ──────────────────────────────────
export default function StatsScreen() {
  const { user, todayStats, weeklyStats, snapshots, settings, setTodayStats, setWeeklyStats, addSnapshot } = useStore();
  const [tab, setTab] = useState<'weekly' | 'monthly'>('monthly');
  const [showTodayDetail, setShowTodayDetail] = useState(false);
  const [showWeekDetail, setShowWeekDetail] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [localSnapshots, setLocalSnapshots] = useState<PostureSnapshot[]>(snapshots);

  const chartData = weeklyStats.map(w => ({ label: w.weekLabel, score: w.avgScore }));
  const todayLabel = scoreToLabel(todayStats?.dailyScore ?? 0);
  const todayBadgeColor = scoreToBadgeColor(todayStats?.dailyScore ?? 0);

  useEffect(() => {
    if (!user || user.isGuest) return;
    setLoading(true);
    Promise.all([
      getTodayStats(user.id),
      getWeeklyStats(user.id),
      getSnapshots(user.id),
    ])
      .then(([today, weekly, snaps]) => {
        if (today) setTodayStats(today);
        if (weekly.length > 0) setWeeklyStats(weekly);
        setLocalSnapshots(snaps);
        snaps.forEach(s => addSnapshot(s));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>활동 기록</Text>
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.base, paddingBottom: 32 }}>
        {/* 오늘 요약 */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>오늘의 요약</Text>
        </View>

        <View style={s.todayCard}>
          <View style={s.todayScoreRow}>
            <View style={[s.todayIconBox, { backgroundColor: todayBadgeColor }]}>
              <Text style={s.todayIcon}>◉</Text>
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={s.todayScoreSub}>오늘 점수</Text>
              <Text style={s.todayScoreNum}>{todayStats?.dailyScore ?? '--'}</Text>
            </View>
            <View style={s.goodBadge}>
              <View style={[s.goodDot, { backgroundColor: todayBadgeColor }]} />
              <Text style={[s.goodText, { color: todayBadgeColor }]}>{todayLabel}</Text>
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
                <Text style={s.miniLabel}>교정 횟수</Text>
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
            {chartData.length >= 2 ? (
              <LineChart
                data={chartData}
                targetScore={settings.targetScore}
                width={width - SPACING.base * 4}
                height={160}
              />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartText}>데이터가 쌓이면 그래프가 표시됩니다</Text>
              </View>
            )}
          </View>

          {/* 월 네비게이션 */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => setMonthOffset(p => p + 1)}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.monthLabel}>{monthOffset === 0 ? '이번 달' : `${monthOffset}개월 전`}</Text>
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

      <TodayDetailModal
        visible={showTodayDetail}
        onClose={() => setShowTodayDetail(false)}
        snapshots={localSnapshots}
      />
      <WeekDetailModal visible={showWeekDetail} onClose={() => setShowWeekDetail(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  pageTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  targetLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  todayCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.md },
  todayScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.base },
  todayIconBox: {
    width: 48, height: 48, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  todayIcon: { fontSize: 22, color: '#fff' },
  todayScoreSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  todayScoreNum: { fontSize: FONTS.sizes['3xl'], fontWeight: '800', color: COLORS.text },
  goodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goodDot: { width: 6, height: 6, borderRadius: 3 },
  goodText: { fontSize: FONTS.sizes.sm, fontWeight: '600' },

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
  emptyChart: { height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  navArrow: { fontSize: 22, color: COLORS.textSecondary, padding: SPACING.sm },
  monthLabel: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
});
