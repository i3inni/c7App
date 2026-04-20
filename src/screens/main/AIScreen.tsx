import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants/theme';
import {
  analyzeExercises, analyzeWeeklyReport, analyzeDiagnosis,
  classifyLevel, levelToMeta,
  ExerciseStep, WeeklyReport, LLMDiagnosis,
} from '../../services/aiService';

type Step = 1 | 2 | 3;

const STEP_COLORS: Record<Step, string> = {
  1: COLORS.step1,
  2: COLORS.step2,
  3: COLORS.step3,
};

export default function AIScreen() {
  const nav = useNavigation();
  const {
    currentAngle, currentScore, currentPostureType, currentDiagnosisLevel,
    todayStats, weeklyStats,
    lastDiagnosis, setLastDiagnosis,
    lastExercises: lastExercisesCache, lastExercisesAt, setLastExercises,
    lastDiagnosisAt,
    lastWeeklyReport, setLastWeeklyReport,
  } = useStore();

  const now = Date.now();

  // 진단: 6시간
  const DIAGNOSIS_INTERVAL = 6 * 60 * 60 * 1000;
  const canRefresh = !lastDiagnosisAt || (now - lastDiagnosisAt) >= DIAGNOSIS_INTERVAL;
  const nextRefreshMs = lastDiagnosisAt ? Math.max(0, DIAGNOSIS_INTERVAL - (now - lastDiagnosisAt)) : 0;
  const nextRefreshHour = Math.floor(nextRefreshMs / (60 * 60 * 1000));
  const nextRefreshMin = Math.floor((nextRefreshMs % (60 * 60 * 1000)) / (60 * 1000));

  // 솔루션: 1시간
  const EXERCISE_INTERVAL = 60 * 60 * 1000;
  const canRefreshEx = !lastExercisesAt || (now - lastExercisesAt) >= EXERCISE_INTERVAL;
  const nextExMs = lastExercisesAt ? Math.max(0, EXERCISE_INTERVAL - (now - lastExercisesAt)) : 0;
  const nextExMin = Math.floor(nextExMs / (60 * 1000));

  // 레벨/배지: ML 모델 출력 우선, 없으면 각도 기반 폴백
  const level = currentDiagnosisLevel ?? classifyLevel(currentAngle);
  const { levelText, badgeText, badgeColor, warningIcon } = levelToMeta(level);

  const [activeStep, setActiveStep] = useState<Step>(1);

  // 진단 결과: LLM (캐시 우선, 버튼으로 갱신)
  const [diagnosis, setDiagnosis] = useState<LLMDiagnosis | null>(lastDiagnosis);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const fetchDiagnosis = useCallback(async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const result = await analyzeDiagnosis(currentPostureType, currentAngle, currentScore, weeklyStats, todayStats);
      setDiagnosis(result);
      setLastDiagnosis(result);
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : '진단 중 오류가 발생했습니다.');
    } finally {
      setDiagLoading(false);
    }
  }, [currentPostureType, currentAngle, currentScore, weeklyStats, todayStats]);

  // 단계별 운동: LLM
  const [exercises, setExercises] = useState<[ExerciseStep, ExerciseStep, ExerciseStep] | null>(lastExercisesCache);
  const [exLoading, setExLoading] = useState(false);
  const [exError, setExError] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    setExLoading(true);
    setExError(null);
    try {
      const result = await analyzeExercises(level, currentAngle, currentScore);
      setExercises(result);
      setLastExercises(result);
    } catch (e) {
      setExError(e instanceof Error ? e.message : '운동 추천 중 오류가 발생했습니다.');
    } finally {
      setExLoading(false);
    }
  }, [level, currentAngle, currentScore]);

  // 주간 리포트: 버튼 눌러야 분석
  const [report, setReport] = useState<WeeklyReport | null>(lastWeeklyReport);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const fetchReport = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const result = await analyzeWeeklyReport(currentScore, todayStats, weeklyStats);
      setReport(result);
      setLastWeeklyReport(result);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setReportLoading(false);
    }
  };

  const ex = exercises?.[activeStep - 1];
  const stepColor = STEP_COLORS[activeStep];

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
            <Text style={styles.aiDesc}>AI 기반 맞춤형 자세 진단 및 교정 전문가입니다</Text>
          </View>
        </View>

        {/* 오늘의 진단 결과 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📋</Text>
            <Text style={styles.sectionTitle}>오늘의 진단 결과</Text>
          </View>

          <View style={styles.diagCard}>
            <View style={styles.diagTop}>
              <Text style={styles.diagWarningIcon}>{warningIcon}</Text>
              <Text style={styles.diagTitle}>{levelText}</Text>
              <View style={[styles.cautionBadge, { backgroundColor: `${badgeColor}20` }]}>
                <Text style={[styles.cautionText, { color: badgeColor }]}>{badgeText}</Text>
              </View>
            </View>

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
                <Text style={[styles.diagStatVal, { color: COLORS.primary }]}>
                  {diagnosis?.improvementRate ?? '-'}
                </Text>
              </View>
            </View>

            {/* LLM 진단 영역 */}
            {!diagnosis && !diagLoading && !diagError && (
              <TouchableOpacity style={styles.diagFetchBtn} onPress={fetchDiagnosis} activeOpacity={0.85}>
                <View style={styles.diagFetchBtnInner}>
                  <Text style={styles.diagFetchBtnIcon}>🩺</Text>
                  <View>
                    <Text style={styles.diagFetchBtnTitle}>AI 진단 받기</Text>
                    <Text style={styles.diagFetchBtnSub}>자세 데이터 기반 상세 분석</Text>
                  </View>
                </View>
                <Text style={styles.diagFetchBtnArrow}>›</Text>
              </TouchableOpacity>
            )}

            {diagLoading && (
              <View style={styles.diagLoadingBox}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.diagLoadingText}>AI가 자세를 분석 중입니다...</Text>
              </View>
            )}

            {diagError && !diagLoading && (
              <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
                <Text style={styles.exErrorText}>⚠️ {diagError}</Text>
                <TouchableOpacity style={styles.analyzeBtn} onPress={fetchDiagnosis}>
                  <Text style={styles.analyzeBtnText}>다시 진단받기</Text>
                </TouchableOpacity>
              </View>
            )}

            {diagnosis && !diagLoading && (
              <>
                <Text style={styles.diagDesc}>{diagnosis.description}</Text>
                <View style={styles.diagRiskBox}>
                  <Text style={styles.diagRiskText}>⚠️ {diagnosis.riskMessage}</Text>
                </View>
                <View style={styles.diagTipBox}>
                  <Text style={styles.diagTipText}>💡 {diagnosis.actionTip}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 다음 진단 가능 시간 */}
        {!canRefresh && (
          <View style={styles.refreshInfo}>
            <Text style={styles.refreshInfoText}>
              🕐 다음 진단 갱신까지 {nextRefreshHour}시간 {nextRefreshMin}분
            </Text>
          </View>
        )}

        {/* 단계별 솔루션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>💡</Text>
            <Text style={styles.sectionTitle}>단계별 솔루션</Text>
          </View>

          {!exercises && !exLoading && !exError && canRefreshEx && (
            <TouchableOpacity style={styles.solutionBtn} onPress={fetchExercises} activeOpacity={0.85}>
              <View style={styles.solutionBtnInner}>
                <Text style={styles.solutionBtnIcon}>🏋️</Text>
                <View>
                  <Text style={styles.solutionBtnTitle}>맞춤 운동 솔루션 받기</Text>
                  <Text style={styles.solutionBtnSub}>진단 결과 기반 3단계 교정 운동 추천</Text>
                </View>
              </View>
              <Text style={styles.solutionBtnArrow}>›</Text>
            </TouchableOpacity>
          )}

          {exLoading && (
            <View style={styles.exLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.exLoadingText}>AI가 맞춤 운동을 준비 중입니다...</Text>
            </View>
          )}

          {exError && !exLoading && (
            <View style={{ gap: SPACING.sm }}>
              <Text style={styles.exErrorText}>⚠️ {exError}</Text>
              <TouchableOpacity style={styles.analyzeBtn} onPress={fetchExercises}>
                <Text style={styles.analyzeBtnText}>다시 받기</Text>
              </TouchableOpacity>
            </View>
          )}

          {exercises && !exLoading && (
            <>
              <View style={styles.stepRow}>
                {([1, 2, 3] as Step[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.stepTab, activeStep === s && { backgroundColor: STEP_COLORS[s] }]}
                    onPress={() => setActiveStep(s)}
                  >
                    <Text style={[styles.stepTabText, activeStep === s && styles.stepTabTextActive]}>
                      {s}단계
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {ex && (
                <View style={[styles.exCard, { borderLeftColor: stepColor, borderLeftWidth: 3 }]}>
                  <View style={styles.exTop}>
                    <Text style={styles.exActivityIcon}>📈</Text>
                    <View style={[styles.exBadge, { backgroundColor: stepColor }]}>
                      <Text style={styles.exBadgeText}>STEP {activeStep}</Text>
                    </View>
                    <Text style={styles.exTitle}>{ex.title}</Text>
                  </View>
                  <Text style={styles.exDesc}>{ex.desc}</Text>
                  <View style={styles.exRepsRow}>
                    <Text style={styles.repsLabel}>권장 횟수</Text>
                    <Text style={[styles.repsVal, { color: stepColor }]}>{ex.reps}</Text>
                  </View>
                  <View style={styles.tipBox}>
                    <Text style={styles.tipText}>💡 Tip: {ex.tip}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* 솔루션 타이머 뱃지 / 갱신 버튼 */}
        {exercises && !exLoading && (
          canRefreshEx ? (
            <TouchableOpacity style={styles.refreshInfo} onPress={fetchExercises}>
              <Text style={styles.refreshInfoText}>🔄 새 솔루션 받기</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.refreshInfo}>
              <Text style={styles.refreshInfoText}>🕐 다음 솔루션 갱신까지 {nextExMin}분</Text>
            </View>
          )
        )}

        {/* 주간 건강 리포트 */}
        <View style={[styles.section, { paddingHorizontal: SPACING.base }]}>
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.reportIconBox}>
                <Text style={styles.reportIcon}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>주간 건강 리포트</Text>
                <Text style={styles.reportSub}>Based on 7 days monitoring</Text>
              </View>
            </View>

            {!report && !reportLoading && !reportError && (
              <TouchableOpacity style={styles.reportAnalyzeBtn} onPress={fetchReport} activeOpacity={0.85}>
                <View style={styles.reportAnalyzeBtnInner}>
                  <Text style={styles.reportAnalyzeBtnIcon}>📊</Text>
                  <View>
                    <Text style={styles.reportAnalyzeBtnTitle}>주간 리포트 분석하기</Text>
                    <Text style={styles.reportAnalyzeBtnSub}>7일간의 자세 데이터 AI 분석</Text>
                  </View>
                </View>
                <Text style={styles.reportAnalyzeBtnArrow}>›</Text>
              </TouchableOpacity>
            )}

            {reportLoading && (
              <View style={styles.reportLoadingBox}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.reportLoadingText}>AI가 주간 데이터를 분석 중입니다...</Text>
              </View>
            )}

            {reportError && !reportLoading && (
              <View style={{ gap: SPACING.sm }}>
                <Text style={styles.reportErrorText}>⚠️ {reportError}</Text>
                <TouchableOpacity style={styles.analyzeBtn} onPress={fetchReport}>
                  <Text style={styles.analyzeBtnText}>다시 분석하기</Text>
                </TouchableOpacity>
              </View>
            )}

            {report && !reportLoading && (
              <>
                <Text style={styles.reportBody}>{report.summary}</Text>

                <View style={styles.reportStatRow}>
                  <View style={styles.reportStatBox}>
                    <Text style={styles.reportStatLabel}>최고 점수</Text>
                    <Text style={styles.reportStatVal}>{report.bestScore}<Text style={styles.reportStatUnit}>점</Text></Text>
                  </View>
                  <View style={styles.reportStatDivider} />
                  <View style={styles.reportStatBox}>
                    <Text style={styles.reportStatLabel}>평균 점수</Text>
                    <Text style={styles.reportStatVal}>{report.avgScore}<Text style={styles.reportStatUnit}>점</Text></Text>
                  </View>
                  <View style={styles.reportStatDivider} />
                  <View style={styles.reportStatBox}>
                    <Text style={styles.reportStatLabel}>추세</Text>
                    <Text style={[styles.reportStatVal, { color: report.trend.startsWith('↑') ? '#4ADE80' : '#F87171' }]}>{report.trend}</Text>
                  </View>
                </View>

                <View style={styles.reportInsightBox}>
                  <Text style={styles.reportInsightLabel}>💡 핵심 인사이트</Text>
                  <Text style={styles.reportInsightText}>{report.insight}</Text>
                </View>

                <View style={styles.reportRecommendBox}>
                  <Text style={styles.reportInsightLabel}>🎯 이번 주 추천</Text>
                  <Text style={styles.reportInsightText}>{report.recommendation}</Text>
                </View>

                <TouchableOpacity style={styles.reAnalyzeBtn} onPress={fetchReport}>
                  <Text style={styles.reAnalyzeBtnText}>다시 분석하기</Text>
                </TouchableOpacity>
              </>
            )}
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
  pageTitle: { flex: 1, fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },

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
  cautionBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  cautionText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  diagDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  diagStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.sm },
  diagStat: { alignItems: 'center' },
  diagStatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 4 },
  diagStatVal: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text },

  diagFetchBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
  },
  diagFetchBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  diagFetchBtnIcon: { fontSize: 24 },
  diagFetchBtnTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  diagFetchBtnSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  diagFetchBtnArrow: { fontSize: 20, color: COLORS.primary, fontWeight: '700' },

  diagLoadingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, marginTop: SPACING.sm, paddingVertical: SPACING.sm,
  },
  diagLoadingText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

  diagRiskBox: {
    backgroundColor: COLORS.danger + '10',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.danger,
  },
  diagRiskText: { fontSize: FONTS.sizes.xs, color: COLORS.danger, lineHeight: 18 },

  diagTipBox: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  diagTipText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, lineHeight: 18 },

  stepRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  stepTab: {
    flex: 1, height: 38, borderRadius: RADIUS.full,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },
  stepTabText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  stepTabTextActive: { color: '#fff' },

  exLoadingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: '#fff', borderRadius: RADIUS.xl,
    padding: SPACING.lg, ...SHADOWS.sm,
  },
  exLoadingText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

  exCard: { backgroundColor: '#F8FAFF', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.sm },
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

  solutionBtn: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
  },
  solutionBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  solutionBtnIcon: { fontSize: 28 },
  solutionBtnTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  solutionBtnSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  solutionBtnArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },

  reportCard: { backgroundColor: COLORS.bgDark, borderRadius: RADIUS.xl, padding: SPACING.lg },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.base },
  reportIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  reportIcon: { fontSize: 18 },
  reportTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: '#fff' },
  reportSub: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.4)' },
  reportBody: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: SPACING.base },
  reportStats: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.base },
  reportStat: {},
  reportStatLabel: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.4)' },
  reportStatVal: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: '#fff', marginTop: 4 },

  analyzeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, alignItems: 'center',
  },
  analyzeBtnText: { fontSize: FONTS.sizes.sm, color: '#fff', fontWeight: '700' },
  reAnalyzeBtn: { alignSelf: 'center', paddingVertical: SPACING.xs },
  reAnalyzeBtnText: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

  reportStatRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RADIUS.lg, padding: SPACING.base,
    marginBottom: SPACING.sm,
  },
  reportStatBox: { flex: 1, alignItems: 'center' },
  reportStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)' },
  reportStatUnit: { fontSize: FONTS.sizes.sm, fontWeight: '400', color: 'rgba(255,255,255,0.5)' },

  reportInsightBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md, padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderLeftWidth: 2, borderLeftColor: '#4ADE80',
  },
  reportRecommendBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md, padding: SPACING.sm,
    marginBottom: SPACING.base,
    borderLeftWidth: 2, borderLeftColor: '#60A5FA',
  },
  reportInsightLabel: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginBottom: 4 },
  reportInsightText: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },

  reportAnalyzeBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  reportAnalyzeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reportAnalyzeBtnIcon: { fontSize: 28 },
  reportAnalyzeBtnTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: '#fff' },
  reportAnalyzeBtnSub: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  reportAnalyzeBtnArrow: { fontSize: 24, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },

  reportLoadingBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  reportLoadingText: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.5)' },
  reportErrorText: { fontSize: FONTS.sizes.xs, color: COLORS.danger, lineHeight: 18 },
  exErrorText: { fontSize: FONTS.sizes.xs, color: COLORS.danger, lineHeight: 18 },

  refreshInfo: {
    marginHorizontal: SPACING.base, marginTop: -SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.base,
    alignSelf: 'flex-end',
  },
  refreshInfoText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
});
