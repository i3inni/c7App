import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import Toggle from '../../components/common/Toggle';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import type { AppNotification } from '../../constants/types';

// ── SVG 아이콘 ────────────────────────────────────────
function PersonIcon({ size = 22, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" />
      <Path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"
      />
    </Svg>
  );
}

function BellIcon({ size = 22, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17s-2.5-2-2.5-8.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── 배터리 인디케이터 ──────────────────────────────────
function BatteryIndicator({ level }: { level: number }) {
  const W = 30;
  const H = 14;
  const fillColor = level > 20 ? '#1DB38E' : COLORS.scoreDanger;
  const fillW = Math.max(((W - 6) * Math.min(level, 100)) / 100, 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Svg width={W + 6} height={H + 2}>
        {/* 배터리 본체 */}
        <Rect x="0" y="1" width={String(W)} height={String(H)} rx="3" ry="3"
          stroke="#C0C8D0" strokeWidth="1.5" fill="none" />
        {/* 배터리 캡 */}
        <Rect x={String(W + 0.5)} y={String((H + 2) / 2 - 3)} width="4" height="6" rx="1.5" fill="#C0C8D0" />
        {/* 채우기 */}
        <Rect x="2.5" y="3.5" width={String(fillW)} height={String(H - 5)} rx="1.5" fill={fillColor} />
      </Svg>
      <Text style={batteryStyles.pct}>{level}%</Text>
    </View>
  );
}
const batteryStyles = StyleSheet.create({
  pct: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
});

// ── 게이지 컴포넌트 ──────────────────────────────────
// viewBox "0 0 200 100", 반원: M 20 90 A 80 80 0 0 0 180 90
// strokeDashoffset 방식으로 채움
const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

function PostureGauge({ score, targetScore }: { score: number; targetScore?: number }) {
  const ARC_LEN = Math.PI * 80;

  const animScore = useRef(new Animated.Value(score)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const isExcellent = score >= 90;

  // 점수 변화 시 게이지 부드럽게 전환 (0.8초)
  useEffect(() => {
    Animated.timing(animScore, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score]);

  // 90점 이상일 때 미세 펄스 애니메이션
  useEffect(() => {
    if (isExcellent) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.025, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseScale.setValue(1);
    }
  }, [isExcellent]);

  const dashOffset = animScore.interpolate({
    inputRange: [0, 100],
    outputRange: [ARC_LEN, 0],
  });

  // 니들 위치 (score 기준 정적 계산)
  const ratio = Math.min(Math.max(score / 100, 0), 1);
  const angleDeg = 180 - ratio * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX = 100 + 80 * Math.cos(angleRad);
  const needleY = 90 - 80 * Math.sin(angleRad);
  const needleInnerColor = isExcellent ? COLORS.scoreExcellent : '#fff';

  return (
    <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
      <Svg width={260} height={130} viewBox="0 0 200 100">
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={COLORS.gaugeGreen} />
            <Stop offset="50%" stopColor={COLORS.gaugeYellow} />
            <Stop offset="100%" stopColor={COLORS.gaugeRed} />
          </LinearGradient>
        </Defs>

        {/* 배경 반원 (회색) */}
        <Path
          d="M 20 90 A 80 80 0 0 0 180 90"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* 점수 반원 (그라디언트, 애니메이션) */}
        <AnimatedSvgPath
          d="M 20 90 A 80 80 0 0 0 180 90"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={dashOffset}
        />
        {/* 니들 핸들 */}
        <Circle cx={String(needleX)} cy={String(needleY)} r="8" fill="#D1D5DB" />
        <Circle cx={String(needleX)} cy={String(needleY)} r="4" fill={needleInnerColor} />
      </Svg>
    </Animated.View>
  );
}

// ── 자세 픽토그램 ─────────────────────────────────────
// viewBox "0 0 200 320"
// 척추는 고정, C7포인트(100,140) 중심으로 목+머리가 neckAngle만큼 회전
function PostureFigure({ angle }: { angle: number }) {
  const markerColor =
    angle > 25 ? COLORS.scoreDanger :
    angle > 15 ? COLORS.scoreCaution :
    COLORS.scoreExcellent;

  return (
    <Svg width={160} height={256} viewBox="0 0 200 320">
      {/* 배경 그림자: 이상적인 직립 자세 (회색 반투명) */}
      <G opacity="0.07">
        <Path
          d="M 100 310 Q 100 270 100 220 V 140"
          fill="none" stroke="#64748b" strokeWidth="10"
          strokeLinecap="round" strokeDasharray="2 5"
        />
        <Path
          d="M 100 140 V 88"
          fill="none" stroke="#64748b" strokeWidth="8" strokeLinecap="round"
        />
        <Circle cx="100" cy="40" r="40" fill="#64748b" />
      </G>

      {/* 척추 / 몸통 (고정) */}
      <Path
        d="M 100 310 Q 100 270 100 220 V 140"
        fill="none" stroke="#CBD5E1" strokeWidth="12" strokeLinecap="round"
      />

      {/* C7 포인트 (목-척추 연결부) */}
      <Circle cx="100" cy="140" r="6" fill={markerColor} />

      {/* 목 + 머리: C7(100,140) 중심으로 neckAngle 회전 */}
      <G transform={`rotate(${angle}, 100, 140)`}>
        {/* 목 */}
        <Path
          d="M 100 140 Q 100 114 100 88"
          fill="none" stroke="#475569" strokeWidth="9" strokeLinecap="round"
        />
        {/* 머리 */}
        <Circle cx="100" cy="40" r="40" fill="#1E293B" />
        {/* 눈 하이라이트 */}
        <Circle cx="118" cy="36" r="4" fill="white" opacity="0.2" />
      </G>
    </Svg>
  );
}

// ── 목표 점수 모달 ───────────────────────────────────
const GOAL_MIN = 60;
const GOAL_MAX = 95;

function GoalModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useStore();
  const [val, setVal] = useState(settings.targetScore);
  const trackWidthRef = useRef(1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const r = Math.min(Math.max(e.nativeEvent.locationX / trackWidthRef.current, 0), 1);
        setVal(Math.round(GOAL_MIN + r * (GOAL_MAX - GOAL_MIN)));
      },
      onPanResponderMove: (e) => {
        const r = Math.min(Math.max(e.nativeEvent.locationX / trackWidthRef.current, 0), 1);
        setVal(Math.round(GOAL_MIN + r * (GOAL_MAX - GOAL_MIN)));
      },
    })
  ).current;

  const ratio = (val - GOAL_MIN) / (GOAL_MAX - GOAL_MIN);

  const presets = [
    { label: '쉬움', score: 75 },
    { label: '보통', score: 85 },
    { label: '어려움', score: 90 },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          {/* 헤더 */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>목표 점수 설정</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={COLORS.text} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.desc}>하루 평균 자세 점수 목표를 설정하세요</Text>

          {/* 큰 점수 */}
          <Text style={modalStyles.bigScore}>
            {val}<Text style={modalStyles.unit}> 점</Text>
          </Text>

          {/* 슬라이더 */}
          <View
            style={modalStyles.sliderOuter}
            onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
            {...panResponder.panHandlers}
          >
            {/* 트랙 배경 */}
            <View style={modalStyles.sliderTrack}>
              <View style={[modalStyles.sliderFill, { width: `${ratio * 100}%` as any }]} />
            </View>
            {/* 썸 */}
            <View style={[
              modalStyles.sliderThumb,
              { left: `${ratio * 100}%` as any, transform: [{ translateX: -12 }] },
            ]} />
          </View>
          <View style={modalStyles.sliderLabels}>
            <Text style={modalStyles.sliderMin}>{GOAL_MIN}</Text>
            <Text style={modalStyles.sliderMax}>{GOAL_MAX}</Text>
          </View>

          {/* 프리셋 버튼 */}
          <View style={modalStyles.presetRow}>
            {presets.map(p => (
              <TouchableOpacity
                key={p.label}
                style={[modalStyles.presetBtn, val === p.score && modalStyles.presetActive]}
                onPress={() => setVal(p.score)}
              >
                <Text style={[modalStyles.presetLabel, val === p.score && modalStyles.presetLabelActive]}>
                  {p.label}
                </Text>
                <Text style={[modalStyles.presetScore, val === p.score && modalStyles.presetLabelActive]}>
                  {p.score}점
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 힌트 */}
          <View style={modalStyles.hint}>
            <Text style={modalStyles.hintText}>
              💡 목표 점수는 홈 화면의 게이지 마커에 반영되며, 통계 그래프에도 표시됩니다.
            </Text>
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity
            style={modalStyles.confirmBtn}
            onPress={() => { updateSettings({ targetScore: val }); onClose(); }}
          >
            <Text style={modalStyles.confirmText}>완료</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  card: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 24, padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  desc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  bigScore: {
    fontSize: FONTS.sizes['4xl'], fontWeight: '800',
    color: COLORS.primary, textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  unit: { fontSize: FONTS.sizes.xl, color: COLORS.textSecondary },

  // 슬라이더
  sliderOuter: {
    height: 30, justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  sliderTrack: {
    height: 6, backgroundColor: COLORS.bgSecondary,
    borderRadius: 3, overflow: 'hidden',
  },
  sliderFill: {
    height: 6, backgroundColor: COLORS.primary, borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: 3,                     // (30 - 24) / 2
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2.5, borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  sliderMin: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  sliderMax: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  // 프리셋
  presetRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  presetBtn: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSecondary, alignItems: 'center',
  },
  presetActive: { backgroundColor: COLORS.primaryLight, borderWidth: 1.5, borderColor: COLORS.primary },
  presetLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
  presetLabelActive: { color: COLORS.primary },
  presetScore: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },

  // 힌트
  hint: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(29,179,142,0.25)',
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  hintText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, lineHeight: 18 },

  // 확인 버튼
  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { color: '#fff', fontSize: FONTS.sizes.base, fontWeight: '700' },
});

// ── 알림 카테고리 아이콘 ──────────────────────────────
function NotifIcon({ category }: { category: string }) {
  if (category === 'posture') {
    return (
      <View style={nIconStyles.circleRed}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="#FF4B6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          />
          <Path d="M12 9v4" stroke="#FF4B6E" strokeWidth="2" strokeLinecap="round" />
          <Circle cx="12" cy="17" r="1" fill="#FF4B6E" />
        </Svg>
      </View>
    );
  }
  if (category === 'report') {
    return (
      <View style={nIconStyles.circleBlue}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }
  return (
    <View style={nIconStyles.circleGreen}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#1DB38E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M22 4L12 14.01l-3-3" stroke="#1DB38E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const nIconStyles = StyleSheet.create({
  circleRed:   { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF0F2', alignItems: 'center', justifyContent: 'center' },
  circleBlue:  { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  circleGreen: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EDFAF5', alignItems: 'center', justifyContent: 'center' },
});

// ── 스와이프 삭제 알림 아이템 ─────────────────────────
const SCREEN_W = Dimensions.get('window').width;

function SwipeableNotifItem({ n, onRemove }: { n: AppNotification; onRemove: (id: string) => void }) {
  // 오버레이 좌우 패딩(SPACING.lg=20) 제외한 아이템 너비
  const itemWidth = SCREEN_W - SPACING.lg * 2;

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        snapToOffsets={[0, 80]}
        snapToEnd={false}
      >
        {/* 알림 내용 */}
        <View style={[nStyles.item, { width: itemWidth, marginBottom: 0 }]}>
          <NotifIcon category={n.category} />
          <View style={nStyles.itemContent}>
            <View style={nStyles.itemHeader}>
              <Text style={nStyles.itemTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={nStyles.timeAgo}>{n.timeAgo}</Text>
            </View>
            <Text style={nStyles.itemBody}>{n.body}</Text>
          </View>
        </View>
        {/* 왼쪽으로 밀면 나오는 삭제 버튼 */}
        <TouchableOpacity style={nStyles.deleteBtn} onPress={() => onRemove(n.id)}>
          <Text style={nStyles.deleteBtnText}>삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── 알림 드로어 ──────────────────────────────────────
function NotificationDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { notifications, removeNotification, clearNotifications } = useStore();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={nStyles.overlay}>
        {/* 헤더 */}
        <View style={nStyles.topRow}>
          <Text style={nStyles.sheetTitle}>알림</Text>
          <TouchableOpacity onPress={onClose} style={nStyles.closeBtn}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke={COLORS.text} strokeWidth="2.2" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* 알림 리스트 */}
        {notifications.length === 0 ? (
          <View style={nStyles.empty}>
            <BellIcon size={48} color={COLORS.border} />
            <Text style={nStyles.emptyText}>알림이 없습니다</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.base }}
            style={{ flex: 1 }}
          >
            {notifications.map((n) => (
              <SwipeableNotifItem
                key={n.id}
                n={n}
                onRemove={removeNotification}
              />
            ))}
          </ScrollView>
        )}

        {/* 하단 버튼 */}
        {notifications.length > 0 && (
          <View style={nStyles.footer}>
            <TouchableOpacity style={nStyles.clearBtn} onPress={clearNotifications}>
              <Text style={nStyles.clearText}>모두 지우기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const nStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(245,246,248,0.92)',
    paddingTop: 56,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  sheetTitle: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  itemTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  timeAgo: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  itemBody: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FONTS.sizes.base, color: COLORS.textMuted, marginTop: SPACING.base },
  footer: { paddingTop: SPACING.sm },
  clearBtn: {
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  clearText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, fontWeight: '700' },
  deleteBtn: {
    width: 80,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    marginLeft: SPACING.sm,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.sm },
});

// ── 메인 홈 ──────────────────────────────────────────
export default function HomeScreen() {
  const nav = useNavigation();
  const { user, device, currentScore, currentAngle, currentLevel, settings, setDevice, notifications } = useStore();
  const [showGoal, setShowGoal] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const levelLabel: Record<string, string> = {
    excellent: '우수',
    good: '양호',
    normal: '보통',
    caution: '주의 단계',
    danger: '위험',
  };
  const levelColor: Record<string, string> = {
    excellent: COLORS.scoreExcellent,
    good: COLORS.scoreGood,
    normal: COLORS.scoreNormal,
    caution: COLORS.scoreCaution,
    danger: COLORS.scoreDanger,
  };
  const color = levelColor[currentLevel] ?? COLORS.textSecondary;
  const unread = notifications.filter(n => !n.read).length;
  const isConnected = device.mqttStatus === 'connected';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── 상단 헤더 ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.navigate('MyInfo')} style={styles.profileBtn}>
            <PersonIcon size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.nickname ?? '사용자'} 님</Text>
            <View style={styles.connRow}>
              <View style={[styles.connDot, { backgroundColor: isConnected ? COLORS.connected : COLORS.disconnected }]} />
              <Text style={[styles.connText, { color: isConnected ? COLORS.connected : COLORS.disconnected }]}>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setShowNotif(true)} style={styles.bellBtn}>
            <BellIcon size={22} color={COLORS.text} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── REAL-TIME 라벨 + 배터리 ── */}
        <View style={styles.realtimeRow}>
          <View style={styles.realDot} />
          <Text style={styles.realtimeLabel}>REAL-TIME VISUAL</Text>
          <BatteryIndicator level={device.battery} />
        </View>

        {/* ── 게이지 섹션 ── */}
        <View style={styles.gaugeSection}>
          <TouchableOpacity onPress={() => setShowGoal(true)} activeOpacity={0.9}>
            <PostureGauge score={currentScore} targetScore={settings.targetScore} />
          </TouchableOpacity>

          {/* 점수 오버레이 */}
          <View style={styles.scoreOverlay}>
            <Text style={styles.scoreNum}>{currentScore}</Text>
            <Text style={styles.scoreLabelText}>POSTURE SCORE</Text>
            <TouchableOpacity onPress={() => setShowGoal(true)}>
              <Text style={styles.targetText}>◎ Target: {settings.targetScore}+ 점</Text>
            </TouchableOpacity>
          </View>

          {/* 자세 피규어 */}
          <View style={styles.figureWrap}>
            <PostureFigure angle={currentAngle} />
          </View>
        </View>

        {/* ── 각도 + 상태 ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statKey}>CURRENT ANGLE</Text>
            <Text style={[styles.statVal, { color: COLORS.text }]}>{currentAngle.toFixed(1)}°</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statKey}>STATUS</Text>
            <Text style={[styles.statStatus, { color }]}>
              {currentLevel === 'excellent' ? '✅' : currentLevel === 'good' ? '✅' : '⚠'} {levelLabel[currentLevel]}
            </Text>
          </View>
        </View>

        {/* ── 전원 관리 ── */}
        <View style={styles.powerCard}>
          <View style={styles.powerLeft}>
            <View style={[styles.powerIconBox, device.powerOn && styles.powerIconBoxOn]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2v10M6.3 5.3A8 8 0 1 0 17.7 5.3"
                  stroke={device.powerOn ? COLORS.primary : '#fff'}
                  strokeWidth="2" strokeLinecap="round"
                />
              </Svg>
            </View>
            <View>
              <Text style={styles.powerTitle}>전원 관리</Text>
              <Text style={styles.powerSub}>기기 ON / OFF 및 자동 꺼짐 설정</Text>
            </View>
          </View>
          <Toggle
            value={device.powerOn}
            onToggle={(v) => setDevice({ powerOn: v })}
            activeColor={COLORS.primary}
          />
        </View>

      </ScrollView>

      <GoalModal visible={showGoal} onClose={() => setShowGoal(false)} />
      <NotificationDrawer visible={showNotif} onClose={() => setShowNotif(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: SPACING.xl },

  // 헤더
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { flex: 1, marginLeft: SPACING.sm, alignItems: 'center' },
  userName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  connRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  connDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  connText: { fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 0.5 },
  bellBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  // REAL-TIME 행
  realtimeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.xs,
    marginTop: SPACING.base,
  },
  realDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.accent, marginRight: 6 },
  realtimeLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', flex: 1, letterSpacing: 0.5 },

  // 게이지 섹션
  gaugeSection: { alignItems: 'center' },
  scoreOverlay: { alignItems: 'center', marginTop: -30 },
  scoreNum: { fontSize: FONTS.sizes['5xl'], fontWeight: '800', color: COLORS.text, lineHeight: 56 },
  scoreLabelText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 1 },
  targetText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  figureWrap: { marginTop: SPACING.sm },

  // 통계 행
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.base,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statBox: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: COLORS.border },
  statKey: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  statVal: { fontSize: FONTS.sizes['2xl'], fontWeight: '800' },
  statStatus: { fontSize: FONTS.sizes.base, fontWeight: '700' },

  // 전원 카드
  powerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgDark, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base, marginTop: SPACING.base, padding: SPACING.base,
  },
  powerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  powerIconBox: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  powerIconBoxOn: {
    backgroundColor: 'rgba(29,179,142,0.2)',
  },
  powerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: '#fff' },
  powerSub: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
});
