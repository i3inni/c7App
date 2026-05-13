import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Path } from 'react-native-svg';
import Icon from '../../components/Icon';
import { useStore } from '../../store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getTodayStats, getWeeklyStats } from '../../services/statsService';

const { width } = Dimensions.get('window');

function getLocalOffsetHours(): number {
  return -new Date().getTimezoneOffset() / 60;
}

function formatKoreanHour(hour: number): string {
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}`;
}

function parseHourlyBucket(key: string): { start: number; end: number } | null {
  const match = key.match(/^(\d{2})_(\d{2})$/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function formatHourlyBucketToKst(key: string): string {
  const bucket = parseHourlyBucket(key);
  if (!bucket) return key;
  const offset = getLocalOffsetHours();
  const start = (bucket.start + offset + 24) % 24;
  const end = (bucket.end + offset + 24) % 24;
  return `${formatKoreanHour(start)}-${formatKoreanHour(end)}시`;
}

function getHourlyBucketSortKey(key: string): number {
  const bucket = parseHourlyBucket(key);
  if (!bucket) return 999;
  const offset = getLocalOffsetHours();
  return (bucket.start + offset + 24) % 24;
}

function formatTimeToKst(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const hour = Number(match[1]);
  const minute = match[2];
  const offset = getLocalOffsetHours();
  const localHour = (hour + offset + 24) % 24;
  return `${String(localHour).padStart(2, '0')}:${minute}`;
}

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
      <Line x1={PAD.l} y1={targetY} x2={W - PAD.r} y2={targetY}
        stroke={COLORS.accent} strokeWidth={1.5} strokeDasharray="5,4" opacity={0.6} />
      <Path d={fillPath} fill={COLORS.primary} opacity={0.08} />
      <Polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xOf(i)} cy={yOf(d.score)} r={5} fill="#fff" stroke={COLORS.primary} strokeWidth={2} />
          <SvgText x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={10} fill={COLORS.textSecondary}>{d.label}</SvgText>
          <SvgText x={xOf(i)} y={yOf(d.score) - 10} textAnchor="middle" fontSize={10} fill={COLORS.textSecondary} fontWeight="600">{d.score}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

// ── 오늘 요약 상세 모달 ──────────────────────────────
const BAD_PAGE_SIZE = 10;

function TodayDetailModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { todayStats } = useStore();
  const insets = useSafeAreaInsets();
  const [badPage, setBadPage] = useState(0);
  const [filterHour, setFilterHour] = useState<number | null>(null);
  const [showHourFilter, setShowHourFilter] = useState(false);

  if (!todayStats || !todayStats.summary) return null;

  const hourlyData = Object.entries(todayStats.hourlyScores ?? {})
    .map(([key, score]) => ({
      label: formatHourlyBucketToKst(key),
      score,
      sortKey: getHourlyBucketSortKey(key),
    }))
    .filter(h => h.score > 0)
    .sort((a, b) => a.sortKey - b.sortKey);

  const sortedBadLogs = (todayStats.badPostureLogs ?? [])
    .map(b => {
      const kstTime = formatTimeToKst(b.time);
      const kstHour = Number(kstTime.split(':')[0]);
      return { ...b, kstTime, kstHour };
    })
    .sort((a, b) => a.kstTime.localeCompare(b.kstTime));

  const availableHours = Array.from(new Set(sortedBadLogs.map(b => b.kstHour))).sort((a, b) => a - b);
  const filteredBadLogs = filterHour === null ? sortedBadLogs : sortedBadLogs.filter(b => b.kstHour === filterHour);

  const totalBadPages = Math.ceil(filteredBadLogs.length / BAD_PAGE_SIZE);
  const pagedBadLogs = filteredBadLogs.slice(badPage * BAD_PAGE_SIZE, (badPage + 1) * BAD_PAGE_SIZE);

  const groupedBadLogs: { hour: number; logs: typeof pagedBadLogs }[] = [];
  pagedBadLogs.forEach(log => {
    const last = groupedBadLogs[groupedBadLogs.length - 1];
    if (last && last.hour === log.kstHour) {
      last.logs.push(log);
    } else {
      groupedBadLogs.push({ hour: log.kstHour, logs: [log] });
    }
  });

  const handleFilterHour = (hour: number | null) => {
    setFilterHour(hour);
    setBadPage(0);
    setShowHourFilter(false);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
        <View style={dtStyles.header}>
          <Text style={dtStyles.title}>오늘의 상세 분석</Text>
          <TouchableOpacity onPress={onClose}><Text style={dtStyles.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingBottom: 40 }}>
          {/* 총점 */}
          <View style={dtStyles.scoreCard}>
            <View>
              <Text style={dtStyles.scoreSub}>오늘의 종합 점수</Text>
              <Text style={dtStyles.scoreNum}>{todayStats.summary.dailyScore}</Text>
              <View style={dtStyles.improveRow}>
                <View style={dtStyles.dot} />
                <Text style={dtStyles.improveText}>평균 각도 {todayStats.summary.avgAngle}°</Text>
              </View>
            </View>
            <Icon name="trending-up" size={28} color="#7EE8A2" />
          </View>

          {/* 시간대별 점수 */}
          {hourlyData.length > 0 && (
            <>
              <Text style={dtStyles.sectionTitle}>시간대별 자세 점수</Text>
              <View style={dtStyles.card}>
                {hourlyData.map((h, i) => (
                  <View key={i} style={dtStyles.hourRow}>
                    <Text style={dtStyles.hourLabel}>{h.label}</Text>
                    <View style={dtStyles.barTrack}>
                      <View style={[dtStyles.barFill, { width: `${h.score}%`, backgroundColor: h.score >= 80 ? COLORS.primary : COLORS.warning }]} />
                    </View>
                    <Text style={[dtStyles.hourScore, { color: h.score >= 80 ? COLORS.primary : COLORS.warning }]}>{h.score}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* 불량 자세 기록 */}
          <View style={dtStyles.badHeaderRow}>
            <Text style={dtStyles.sectionTitle}>불량 자세 발생 기록</Text>
            {sortedBadLogs.length > 0 && (
              <TouchableOpacity
                style={[dtStyles.filterBtn, showHourFilter && dtStyles.filterBtnActive]}
                onPress={() => setShowHourFilter(v => !v)}
              >
                <Icon name="clock" size={13} color={showHourFilter || filterHour !== null ? '#fff' : COLORS.textSecondary} />
                <Text style={[dtStyles.filterBtnText, (showHourFilter || filterHour !== null) && dtStyles.filterBtnTextActive]}>
                  {filterHour !== null ? `${formatKoreanHour(filterHour)}시` : '시간 필터'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {showHourFilter && availableHours.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dtStyles.filterChipScroll} contentContainerStyle={{ paddingVertical: 4 }}>
              <TouchableOpacity
                style={[dtStyles.filterChip, filterHour === null && dtStyles.filterChipActive]}
                onPress={() => handleFilterHour(null)}
              >
                <Text style={[dtStyles.filterChipText, filterHour === null && dtStyles.filterChipTextActive]}>전체</Text>
              </TouchableOpacity>
              {availableHours.map(hour => (
                <TouchableOpacity
                  key={hour}
                  style={[dtStyles.filterChip, filterHour === hour && dtStyles.filterChipActive]}
                  onPress={() => handleFilterHour(hour)}
                >
                  <Text style={[dtStyles.filterChipText, filterHour === hour && dtStyles.filterChipTextActive]}>
                    {formatKoreanHour(hour)}시
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {filteredBadLogs.length > 0 && (
            <Text style={dtStyles.badPageInfo}>
              {filterHour !== null ? `${formatKoreanHour(filterHour)}시 · ` : ''}
              {badPage * BAD_PAGE_SIZE + 1}–{Math.min((badPage + 1) * BAD_PAGE_SIZE, filteredBadLogs.length)} / {filteredBadLogs.length}건
            </Text>
          )}

          {filteredBadLogs.length === 0 ? (
            <View style={dtStyles.emptyBox}>
              <Text style={dtStyles.emptyText}>오늘 불량 자세 기록이 없습니다 👍</Text>
            </View>
          ) : (
            <>
              {groupedBadLogs.map(({ hour, logs }) => (
                <View key={hour}>
                  <View style={dtStyles.hourGroupHeader}>
                    <Icon name="clock" size={13} color={COLORS.textSecondary} />
                    <Text style={dtStyles.hourGroupText}>{formatKoreanHour(hour)}시</Text>
                  </View>
                  {logs.map((b, i) => {
                    const isDanger = b.angle >= 25;
                    return (
                      <View key={i} style={[dtStyles.badCard, { backgroundColor: isDanger ? '#FFF0F3' : '#FFF7EC' }]}>
                        <View style={dtStyles.badLeft}>
                          <Text style={[dtStyles.badTime, { color: isDanger ? COLORS.accent : COLORS.warning }]}>
                            {b.kstTime}
                          </Text>
                        </View>
                        <Text style={dtStyles.badDetail}>각도: {b.angle}°    지속시간: {b.duration}</Text>
                        <View style={[dtStyles.levelBadge, { backgroundColor: isDanger ? COLORS.accent : COLORS.warning }]}>
                          <Text style={dtStyles.levelText}>{isDanger ? '위험' : '주의'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}

              {totalBadPages > 1 && (
                <View style={dtStyles.pageNav}>
                  <TouchableOpacity
                    style={[dtStyles.pageBtn, badPage === 0 && dtStyles.pageBtnDisabled]}
                    onPress={() => setBadPage(p => Math.max(0, p - 1))}
                    disabled={badPage === 0}
                  >
                    <Text style={[dtStyles.pageBtnText, badPage === 0 && dtStyles.pageBtnTextDisabled]}>‹ 이전</Text>
                  </TouchableOpacity>
                  <Text style={dtStyles.pageNumText}>{badPage + 1} / {totalBadPages}</Text>
                  <TouchableOpacity
                    style={[dtStyles.pageBtn, badPage === totalBadPages - 1 && dtStyles.pageBtnDisabled]}
                    onPress={() => setBadPage(p => Math.min(totalBadPages - 1, p + 1))}
                    disabled={badPage === totalBadPages - 1}
                  >
                    <Text style={[dtStyles.pageBtnText, badPage === totalBadPages - 1 && dtStyles.pageBtnTextDisabled]}>다음 ›</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* 활동 요약 */}
          <Text style={dtStyles.sectionTitle}>활동 요약</Text>
          <View style={dtStyles.summaryGrid}>
            {[
              { iconName: 'trending-up', iconColor: COLORS.primary,  label: '교정 횟수', val: `${todayStats.summary.correctionCount}회` },
              { iconName: 'clock',       iconColor: COLORS.primary,  label: '사용 시간', val: todayStats.summary.totalUsageTime },
              { iconName: 'target',      iconColor: COLORS.accent,   label: '평균 각도', val: `${todayStats.summary.avgAngle}°` },
              { iconName: 'alert',       iconColor: COLORS.warning,  label: '불량 자세', val: `${todayStats.summary.badPostureCount}회` },
            ].map((s, i) => (
              <View key={i} style={dtStyles.summaryCard}>
                <Icon name={s.iconName} size={24} color={s.iconColor} />
                <Text style={dtStyles.summaryLabel}>{s.label}</Text>
                <Text style={dtStyles.summaryVal}>{s.val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
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
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, textAlign: 'center' },
  summaryVal: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  badHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.base, marginBottom: SPACING.sm },
  badPageInfo: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  hourGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SPACING.xs, marginTop: SPACING.sm },
  hourGroupText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary },
  pageNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  pageBtn: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base, backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.md },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  pageBtnTextDisabled: { color: COLORS.textMuted },
  pageNumText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.full,
  },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterBtnText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterBtnTextActive: { color: '#fff' },
  filterChipScroll: { marginBottom: SPACING.xs },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, marginRight: SPACING.xs,
    backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.full,
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },
});

// ── 주간 상세 모달 ────────────────────────────────────
function WeekDetailModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { weeklyStats } = useStore();
  const insets = useSafeAreaInsets();

  const avgScore = weeklyStats.length > 0
    ? (weeklyStats.reduce((s, w) => s + w.avgScore, 0) / weeklyStats.length).toFixed(1)
    : '--';
  const latestChange = weeklyStats.length >= 1 ? weeklyStats[weeklyStats.length - 1].scoreChange : 0;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
        <View style={dtStyles.header}>
          <Text style={dtStyles.title}>주간 상세 분석</Text>
          <TouchableOpacity onPress={onClose}><Text style={dtStyles.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingBottom: 40 }}>
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
            <Icon name="bar-chart" size={28} color="#FCD34D" />
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
                    {w.targetSuccessDays && (
                      <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textMuted }}>목표 달성 {w.targetSuccessDays}일</Text>
                    )}
                    <View style={[wkStyles.barTrack, { marginTop: 6 }]}>
                      <View style={[wkStyles.barFill, { width: `${w.avgScore}%`, backgroundColor: scoreColor }]} />
                    </View>
                  </View>
                  <Text style={{ fontSize: FONTS.sizes.sm, color: w.scoreChange >= 0 ? COLORS.primary : COLORS.accent, fontWeight: '700' }}>
                    {w.scoreChange >= 0 ? `+${w.scoreChange}` : `${w.scoreChange}`}
                  </Text>
                </View>
              );
            })
          )}

          {/* 요일별 상세 (마지막 주) */}
          {weeklyStats.length > 0 && weeklyStats[weeklyStats.length - 1].dailyBreakdown && (
            <>
              <Text style={dtStyles.sectionTitle}>이번 주 요일별 점수</Text>
              {weeklyStats[weeklyStats.length - 1].dailyBreakdown!.map((d, i) => {
                const c = d.score >= 80 ? COLORS.primary : d.score >= 70 ? COLORS.scoreNormal : COLORS.accent;
                return (
                  <View key={i} style={[wkStyles.dayRow, d.score < 70 && wkStyles.dayRowBad]}>
                    <View style={[wkStyles.scoreBadge, { backgroundColor: c }]}>
                      <Text style={wkStyles.scoreBadgeText}>{d.score}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={wkStyles.dayName}>{d.day}요일</Text>
                      <View style={[wkStyles.barTrack, { marginTop: 6 }]}>
                        <View style={[wkStyles.barFill, { width: `${d.score}%`, backgroundColor: c }]} />
                      </View>
                    </View>
                    <Text style={{ fontSize: FONTS.sizes.sm, color: d.change >= 0 ? COLORS.primary : COLORS.accent, fontWeight: '700' }}>
                      {d.change >= 0 ? `+${d.change}` : `${d.change}`}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
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
  scoreBadge: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: FONTS.sizes.base, fontWeight: '800', color: '#fff' },
  dayName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  barTrack: { height: 4, backgroundColor: COLORS.bgSecondary, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  bestBadge: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 },
  bestText: { fontSize: 9, color: '#fff', fontWeight: '700' },
});

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
  const nav = useNavigation();
  const { user, todayStats, weeklyStats, settings, setTodayStats, setWeeklyStats } = useStore();
  const [tab, setTab] = useState<'weekly' | 'monthly'>('monthly');
  const [showTodayDetail, setShowTodayDetail] = useState(false);
  const [showWeekDetail, setShowWeekDetail] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const latestWeek = weeklyStats.length > 0 ? weeklyStats[weeklyStats.length - 1] : null;
  const weeklyChartData = (latestWeek?.dailyBreakdown ?? []).map(d => ({ label: d.day, score: d.score }));
  const monthlyChartData = weeklyStats.map(w => ({ label: w.weekLabel, score: w.avgScore }));
  const chartData = tab === 'weekly' ? weeklyChartData : monthlyChartData;
  const dailyScore = todayStats?.summary?.dailyScore ?? 0;
  const todayLabel = todayStats?.summary ? scoreToLabel(dailyScore) : '--';
  const todayBadgeColor = scoreToBadgeColor(dailyScore);

  const fetchAll = async (isRefresh = false) => {
    if (!user || user.isGuest) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [today, weekly] = await Promise.all([
        getTodayStats(user.id),
        getWeeklyStats(user.id, monthOffset),
      ]);
      if (today) setTodayStats(today);
      setWeeklyStats(weekly);
    } catch {}
    if (isRefresh) setRefreshing(false); else setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user?.id, monthOffset]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.navigate('HOME' as never)} style={s.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 19l-7-7 7-7" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.pageTitle}>활동 기록</Text>
          <Text style={s.pageSub}>Posture Statistics</Text>
        </View>
        <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
          {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.base, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* 오늘 요약 */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>오늘의 요약</Text>
        </View>

        <View style={s.todayCard}>
          {!todayStats || !todayStats.summary ? (
            <View style={s.emptyChart}>
              <Text style={s.emptyChartText}>오늘의 데이터가 없습니다</Text>
            </View>
          ) : (
            <>
              <View style={s.todayScoreRow}>
                <View style={[s.todayIconBox, { backgroundColor: todayBadgeColor }]}>
                  <Icon name="activity" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={s.todayScoreSub}>오늘 점수</Text>
                  <Text style={s.todayScoreNum}>{dailyScore}</Text>
                </View>
                <View style={s.goodBadge}>
                  <View style={[s.goodDot, { backgroundColor: todayBadgeColor }]} />
                  <Text style={[s.goodText, { color: todayBadgeColor }]}>{todayLabel}</Text>
                </View>
              </View>

              <View style={s.todayMiniRow}>
                <View style={s.todayMiniBox}>
                  <View style={[s.miniIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="alert" size={18} color={COLORS.warning} />
                  </View>
                  <View>
                    <Text style={s.miniLabel}>불량 자세</Text>
                    <Text style={s.miniVal}>{todayStats.summary.badPostureCount}<Text style={s.miniUnit}> 회</Text></Text>
                  </View>
                </View>
                <View style={s.todayMiniBox}>
                  <View style={[s.miniIconCircle, { backgroundColor: '#D1FAE5' }]}>
                    <Icon name="clock" size={18} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={s.miniLabel}>교정 횟수</Text>
                    <Text style={s.miniVal}>{todayStats.summary.correctionCount}<Text style={s.miniUnit}> 회</Text></Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={s.moreBtn} onPress={() => setShowTodayDetail(true)}>
                <Text style={s.moreBtnText}>더 보기  ›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 자세 측정 지표 */}
        <View style={[s.sectionHeader, { marginTop: SPACING.lg }]}>
          <Text style={s.sectionTitle}>자세 측정 지표</Text>
          <Text style={s.targetLabel}>— 목표 {settings.targetScore}</Text>
        </View>

        <View style={s.chartCard}>
          <View style={s.tabRow}>
            {(['weekly', 'monthly'] as const).map(t => (
              <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'weekly' ? '주간' : '월간'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: SPACING.sm }}>
            <Text style={s.chartSub}>
              {tab === 'weekly' ? '이번 주 요일별 점수' : '평균 점수의 주별 추이'}
            </Text>
            {chartData.length >= 2 ? (
              <LineChart data={chartData} targetScore={settings.targetScore} width={width - SPACING.base * 4} height={160} />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartText}>데이터가 쌓이면 그래프가 표시됩니다</Text>
              </View>
            )}
          </View>

          {tab === 'monthly' && (
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
          )}

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  pageTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  pageSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  targetLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  todayCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.md },
  todayScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.base },
  todayIconBox: { width: 48, height: 48, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },

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
  miniIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  miniLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 2 },
  miniVal:   { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  miniUnit:  { fontSize: FONTS.sizes.sm, fontWeight: '400', color: COLORS.textSecondary },
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
  emptyChart: { height: 80, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  navArrow: { fontSize: 22, color: COLORS.textSecondary, padding: SPACING.sm },
  monthLabel: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
});
