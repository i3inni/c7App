import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Circle, Path, G, Rect } from 'react-native-svg';
import { useStore } from '../../store';
import SpineVisualizer from '../../components/common/SpineVisualizer';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? '';
const BASELINE_SEC = 5;
const TRAINING_POSE_SEC = 30;

const POSES = [
  { key: 'normal',       label: '바른 자세',       instruction: '등을 펴고 화면을 바라보는\n편안한 바른 자세를 유지하세요.'         },
  { key: 'forward_head', label: '거북목',           instruction: '고개를 앞으로 쭉 내밀고\n화면에 가까이 숙이는 자세를 유지하세요.' },
  { key: 'kyphosis',     label: '굽은등',           instruction: '어깨를 앞으로 구부리고\n등을 둥글게 말아주세요.'                  },
  { key: 'lateral_tilt', label: '옆으로 기울어짐', instruction: '몸을 한쪽으로 기울이거나\n다리를 꼬고 앉아주세요.'                },
] as const;

function PoseIcon({ poseKey, size = 72 }: { poseKey: string; size?: number }) {
  const c = COLORS.primary;
  const sw = 2.6;
  switch (poseKey) {
    case 'normal':
      return (
        <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
          <Circle cx="36" cy="10" r="8" stroke={c} strokeWidth={sw} />
          <Path d="M36 18 L36 48" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 30 L50 30" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 30 L22 44 M50 30 L50 44" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M24 48 L48 48" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M28 48 L28 62 L14 62 M44 48 L44 62 L58 62" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'forward_head':
      return (
        <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
          <Circle cx="48" cy="10" r="8" stroke={c} strokeWidth={sw} />
          <Path d="M42 18 L36 30" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M36 30 L36 52" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 34 L50 30" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 34 L22 48 M48 30 L48 44" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M26 52 L46 52" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M30 52 L30 66 M42 52 L42 66" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'kyphosis':
      return (
        <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
          <Circle cx="44" cy="10" r="8" stroke={c} strokeWidth={sw} />
          <Path d="M40 18 Q20 28 24 50" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Path d="M20 28 L44 22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M20 28 L16 42 M44 22 L50 36" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M20 52 L40 50" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M24 54 L22 68 M36 52 L38 66" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'lateral_tilt':
      return (
        <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
          <Circle cx="46" cy="10" r="8" stroke={c} strokeWidth={sw} />
          <Path d="M42 18 L28 52" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M18 26 L54 20" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M18 26 L14 40 M54 20 L58 34" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 54 L40 50" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M26 56 L22 70 M36 52 L36 68" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M62 38 L68 32 M62 38 L68 44" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

type Step = 'baseline_ready' | 'baseline_capturing' | 'pose_ready' | 'pose_collecting' | 'training' | 'done' | 'error';
type RouteParams = { PoseCalibration: { deviceId: string; mode?: 'setup' | 'training' } };

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data.detail ?? data.message ?? fallback;
  } catch {
    return fallback;
  }
}

function getTargetAngles(height?: number, weight?: number) {
  let c7 = 5, t3 = 6, t7 = 8;
  if (height && height >= 175) { c7 += 1; t3 += 1; t7 += 1; }
  if (height && weight) {
    const bmi = weight / Math.pow(height / 100, 2);
    if (bmi >= 25) { c7 += 1; t3 += 1; t7 += 1; }
  }
  return { c7, t3, t7 };
}

function ZoneCard({ zone, current, target }: { zone: string; current: number; target: number }) {
  const diff  = current - target;
  const ok    = diff <= 0;
  const warn  = !ok && diff < 3;
  const color = ok ? COLORS.scoreExcellent : warn ? COLORS.scoreCaution : COLORS.scoreDanger;
  return (
    <View style={[zs.card, { borderColor: color }]}>
      <Text style={[zs.zone, { color }]}>{zone}</Text>
      <Text style={[zs.val,  { color }]}>{current.toFixed(1)}°</Text>
      <Text style={zs.target}>목표 ≤{target}°</Text>
    </View>
  );
}
const zs = StyleSheet.create({
  card:   { flex: 1, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1.5, backgroundColor: '#fff' },
  zone:   { fontSize: FONTS.sizes.xs, fontWeight: '800', marginBottom: 2 },
  val:    { fontSize: FONTS.sizes.lg, fontWeight: '900' },
  target: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
});

const SCREEN_H = Dimensions.get('window').height;

export default function CalibrationScreen() {
  const nav   = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PoseCalibration'>>();
  const { deviceId, mode = 'setup' } = route.params;
  const isTrainingMode = mode === 'training';

  const { user, currentAngles, currentRolls } = useStore();
  const userId  = user?.id ?? 'unknown';
  const targets = getTargetAngles(user?.height, user?.weight);

  const [step,     setStep]     = useState<Step>('baseline_ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [baselineP, setBaselineP] = useState<number[]>([0, 0, 0]);
  const [baselineR, setBaselineR] = useState<number[]>([0, 0, 0]);
  const [poseIdx, setPoseIdx] = useState(0);
  const [countdown, setCountdown] = useState(TRAINING_POSE_SEC);
  const [trainResult, setTrainResult] = useState<{ test_acc: number; total_samples: number } | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spineH = Math.round(SCREEN_H * 0.35);
  const spineW = Math.round(spineH / 2);

  const isReady =
    currentAngles.c7 <= targets.c7 &&
    currentAngles.t3 <= targets.t3 &&
    currentAngles.t7 <= targets.t7;
  const currentPose = POSES[poseIdx];

  const goHome = () => (nav as any).replace('MainTabs');

  const ExitButton = () => (
    <TouchableOpacity style={s.exitBtn} onPress={goHome}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke={COLORS.textSecondary} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    </TouchableOpacity>
  );

  const startBaseline = async () => {
    setStep('baseline_capturing');
    try {
      if (!SERVER_URL) {
        throw new Error('서버 주소가 설정되지 않았습니다.');
      }

      const res = await fetch(`${SERVER_URL}/pose-calibration/baseline`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, duration_sec: BASELINE_SEC }),
      });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, '영점 측정 실패'));
      }
      const data = await res.json();

      if (isTrainingMode) {
        setBaselineP(data.baseline_p);
        setBaselineR(data.baseline_r);
        setStep('pose_ready');
        return;
      }

      const calRes = await fetch(`${SERVER_URL}/calibrate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac:       deviceId,
          user_id:   userId,
          height_cm: user?.height ?? 170,
          weight_kg: user?.weight ?? 65,
          age:       25,
          p:         data.baseline_p,
          r:         data.baseline_r,
        }),
      });
      if (!calRes.ok) {
        throw new Error(await getErrorMessage(calRes, '영점 저장 실패'));
      }

      goHome();
    } catch (e: any) {
      setErrorMsg(e.message ?? '영점 측정 중 오류가 발생했습니다.');
      setStep('error');
    }
  };

  const startCollect = () => {
    setStep('pose_collecting');
    setCountdown(TRAINING_POSE_SEC);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: TRAINING_POSE_SEC * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    fetch(`${SERVER_URL}/pose-calibration/collect`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id:    deviceId,
        user_id:      userId,
        label:        currentPose.key,
        baseline_p:   baselineP,
        baseline_r:   baselineR,
        duration_sec: TRAINING_POSE_SEC,
      }),
    })
      .then(async res => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!res.ok) {
          throw new Error(await getErrorMessage(res, '자세 데이터 수집 실패'));
        }
        if (poseIdx < POSES.length - 1) {
          setPoseIdx(i => i + 1);
          setStep('pose_ready');
        } else {
          setStep('training');
          await runTraining();
        }
      })
      .catch((e: any) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setErrorMsg(e.message ?? '자세 데이터 수집 중 오류가 발생했습니다.');
        setStep('error');
      });
  };

  const runTraining = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/pose-calibration/train`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, '모델 학습 실패'));
      }
      const data = await res.json();
      setTrainResult({ test_acc: data.test_acc, total_samples: data.total_samples });
      setStep('done');
    } catch (e: any) {
      setErrorMsg(e.message ?? '모델 학습 중 오류가 발생했습니다.');
      setStep('error');
    }
  };

  // ── 공통 헤더 ────────────────────────────────────────
  const Header = ({ sub, title }: { sub: string; title: string }) => (
    <View style={s.header}>
      <View>
        <Text style={s.headerSub}>{sub}</Text>
        <Text style={s.headerTitle}>{title}</Text>
      </View>
      <ExitButton />
    </View>
  );

  // ── 1. 영점 측정 준비 ─────────────────────────────────
  if (step === 'baseline_ready') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Header sub={isTrainingMode ? 'PRECISION' : 'SETUP'} title={isTrainingMode ? '정밀 자세 학습' : '영점 측정'} />

          <View style={s.vizCard}>
            <SpineVisualizer angles={currentAngles} rolls={currentRolls} width={spineW} height={spineH} />
          </View>

          <View style={s.zoneRow}>
            <ZoneCard zone="C7" current={currentAngles.c7} target={targets.c7} />
            <ZoneCard zone="T3" current={currentAngles.t3} target={targets.t3} />
            <ZoneCard zone="T7" current={currentAngles.t7} target={targets.t7} />
          </View>

          <View style={s.instructionCard}>
            <View style={s.instructionTitleRow}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="3" width="20" height="18" rx="2" stroke={COLORS.text} strokeWidth="1.8" />
                <Path d="M2 8h20M2 13h20M9 3v18" stroke={COLORS.text} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
              <Text style={s.instructionTitle}>벽에 기대어 서주세요</Text>
            </View>
            <Text style={s.instructionText}>
              뒤통수 · 어깨 · 엉덩이 · 발뒤꿈치를 벽에 붙이고{'\n'}
              편안하게 정자세로 서주세요.{'\n\n'}
              {isTrainingMode
                ? '먼저 기준 자세를 측정한 뒤 자세별 데이터를 수집합니다.'
                : '세 구간이 모두 초록이 되면 측정을 시작하세요.'}
            </Text>
            {user?.height && user?.weight ? (
              <Text style={s.bodyInfo}>키 {user.height}cm · 체중 {user.weight}kg 기준 적용됨</Text>
            ) : (
              <Text style={s.bodyInfoMuted}>프로필에 키·체중을 입력하면 맞춤 기준이 적용됩니다.</Text>
            )}
          </View>

          <TouchableOpacity style={[s.btn, !isReady && s.btnWaiting]} onPress={startBaseline} disabled={!isReady}>
            <Text style={s.btnText}>{isReady ? (isTrainingMode ? '기준 자세 측정  →' : '이 자세로 영점 측정  →') : '자세를 맞춰주세요…'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.skipBtn} onPress={goHome}>
            <Text style={s.skipText}>나중에 하기</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── 2. 영점 측정 중 ──────────────────────────────────
  if (step === 'baseline_capturing') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerContent}>
          <Header sub={isTrainingMode ? 'PRECISION' : 'SETUP'} title={isTrainingMode ? '기준 자세 측정 중' : '영점 저장 중'} />
          <View style={s.vizCard}>
            <SpineVisualizer angles={currentAngles} rolls={currentRolls} width={spineW} height={spineH} />
          </View>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
          <Text style={s.capturingLabel}>{BASELINE_SEC}초간 자세 유지 중...</Text>
          <Text style={s.capturingHint}>
            {isTrainingMode ? '측정 후 자세별 학습을 시작합니다.' : '영점을 저장한 뒤 홈으로 이동합니다.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'pose_ready') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Header sub="PRECISION" title="자세 데이터 수집" />

          <View style={s.progressRow}>
            {POSES.map((_, i) => (
              <View key={i} style={[s.dot, i <= poseIdx && s.dotActive]} />
            ))}
          </View>

          <View style={s.vizCard}>
            <SpineVisualizer angles={currentAngles} rolls={currentRolls} width={spineW} height={spineH} />
          </View>

          <View style={s.poseCard}>
            <View style={s.poseEmoji}><PoseIcon poseKey={currentPose.key} size={72} /></View>
            <Text style={s.poseLabel}>{currentPose.label}</Text>
            <Text style={s.poseInstruction}>{currentPose.instruction}</Text>
            <Text style={s.poseTimer}>{TRAINING_POSE_SEC}초간 유지</Text>
          </View>

          <TouchableOpacity style={s.btn} onPress={startCollect}>
            <Text style={s.btnText}>준비됐어요  →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'pose_collecting') {
    const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerContent}>
          <Header sub="PRECISION" title="수집 중" />
          <View style={s.vizCard}>
            <SpineVisualizer angles={currentAngles} rolls={currentRolls} width={spineW} height={spineH} />
          </View>
          <View style={s.collectEmoji}><PoseIcon poseKey={currentPose.key} size={72} /></View>
          <Text style={s.capturingLabel}>{currentPose.label}</Text>
          <Text style={s.capturingHint}>{currentPose.instruction}</Text>
          <Text style={s.countdownNum}>{countdown}</Text>
          <Text style={s.countdownSub}>초 남음</Text>
          <View style={s.barBg}>
            <Animated.View style={[s.barFill, { width: barWidth }]} />
          </View>
          <Text style={s.capturingHint}>자세를 유지하세요. 움직이지 마세요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'training') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.centerContent, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={s.capturingLabel}>AI 모델 학습 중...</Text>
          <Text style={s.capturingHint}>직접 수집한 라벨 데이터로 모델을 재학습합니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.centerContent, { justifyContent: 'center' }]}>
          <Svg width={72} height={72} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={COLORS.primary} strokeWidth="1.8" />
            <Path d="M8 12l3 3 5-5" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={s.doneTitle}>정밀 학습 완료</Text>
          {trainResult && (
            <View style={s.resultBox}>
              <Text style={s.resultRow}>총 샘플 수: <Text style={s.resultVal}>{trainResult.total_samples}개</Text></Text>
              <Text style={s.resultRow}>모델 정확도: <Text style={s.resultVal}>{trainResult.test_acc}%</Text></Text>
            </View>
          )}
          <Text style={s.capturingHint}>이제 새 모델 기준으로 자세 분석이 진행됩니다.</Text>
          <TouchableOpacity style={[s.btn, { marginTop: SPACING.xl }]} onPress={goHome}>
            <Text style={s.btnText}>홈으로  →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 에러 ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.centerContent, { justifyContent: 'center' }]}>
        <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
          <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={COLORS.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 9v4" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="12" cy="17" r="1" fill={COLORS.accent} />
        </Svg>
        <Text style={s.errorTitle}>오류 발생</Text>
        <Text style={s.capturingHint}>{errorMsg}</Text>
        <TouchableOpacity style={[s.btn, { marginTop: SPACING.xl }]} onPress={() => setStep('baseline_ready')}>
          <Text style={s.btnText}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={goHome}>
          <Text style={s.skipText}>홈으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: SPACING.xl },
  centerContent: { flex: 1, alignItems: 'center', paddingBottom: SPACING.xl },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.sm, width: '100%' },
  headerSub:   { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 1 },
  headerTitle: { fontSize: FONTS.sizes['2xl'], fontWeight: '900', color: COLORS.text, marginTop: 2 },
  exitBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  vizCard: {
    alignItems: 'center', width: '88%',
    marginHorizontal: SPACING.xl, marginVertical: SPACING.sm,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md, ...SHADOWS.sm,
  },

  zoneRow: { flexDirection: 'row', marginHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.md },

  instructionCard: {
    marginHorizontal: SPACING.xl, backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(29,179,142,0.25)',
    padding: SPACING.lg, marginBottom: SPACING.xl,
  },
  instructionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  instructionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
  instructionText:  { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 22 },
  bodyInfo:         { marginTop: SPACING.sm, fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  bodyInfoMuted:    { marginTop: SPACING.sm, fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  progressRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  dot:         { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  dotActive:   { backgroundColor: COLORS.primary },

  poseCard: {
    marginHorizontal: SPACING.xl, borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl, ...SHADOWS.md,
  },
  poseEmoji:       { marginBottom: SPACING.md },
  poseLabel:       { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.sm },
  poseInstruction: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  poseTimer:       { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700', marginTop: SPACING.md },

  btn:        { marginHorizontal: SPACING.xl, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 52, alignItems: 'center', justifyContent: 'center', width: '88%' },
  btnWaiting: { backgroundColor: COLORS.textMuted },
  btnText:    { color: '#fff', fontSize: FONTS.sizes.base, fontWeight: '700' },
  skipBtn:    { alignSelf: 'center', marginTop: SPACING.md, paddingVertical: SPACING.sm },
  skipText:   { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },

  capturingLabel: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.lg, textAlign: 'center' },
  capturingHint:  { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.xl },
  collectEmoji:   { marginTop: SPACING.lg },

  countdownNum: { fontSize: 72, fontWeight: '900', color: COLORS.primary, marginTop: SPACING.md },
  countdownSub: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  barBg:        { width: '85%', height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden', marginTop: SPACING.sm },
  barFill:      { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },

  doneTitle:  { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.primary, marginTop: SPACING.xl },
  resultBox:  { backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.md, padding: SPACING.lg, marginTop: SPACING.lg, width: '85%', gap: 6 },
  resultRow:  { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  resultVal:  { fontWeight: '700', color: COLORS.text },

  errorTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.accent, marginTop: SPACING.xl },
});
