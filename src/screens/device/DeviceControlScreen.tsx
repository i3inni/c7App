import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Rect, Circle, Ellipse, Path, G } from "react-native-svg";
import { useStore } from "../../store";
import Toggle from "../../components/common/Toggle";
import ConfirmModal from "../../components/common/ConfirmModal";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from "../../constants/theme";
import { saveDeviceSettings, updateDeviceConnection } from '../../services/deviceService';
import { connectToDevice, sendPowerMode, subscribePowerStatus, PowerStatus } from '../../services/bleService';
import { PowerMode } from '../../constants/types';

type Tab = "battery" | "power";

// ── C7 기기 SVG 일러스트 ─────────────────────────────
function DeviceIllustration({
  highlight,
  onTabChange,
}: {
  highlight: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const hl = (tab: Tab) => {
    return highlight === tab ? COLORS.primary : "#9CA3AF";
  };
  const hlFill = (tab: Tab) => {
    return highlight === tab ? COLORS.primaryLight : "#F3F4F6";
  };

  return (
    <View style={illStyles.wrap}>
      <Svg width={160} height={200} viewBox="0 0 160 200">
        {/* 몸체 */}
        <Rect
          x={30} y={30} width={100} height={140} rx={20}
          fill="#F0F2F5" stroke="#D1D5DB" strokeWidth={1.5}
        />

        {/* 안테나 */}
        <Rect x={50} y={10} width={6} height={28} rx={3} fill="#D1D5DB" transform="rotate(-15 53 24)" />
        <Rect x={104} y={10} width={6} height={28} rx={3} fill="#D1D5DB" transform="rotate(15 107 24)" />

        {/* 전원 버튼 중앙 상단 — 클릭 시 power 탭 */}
        <G onPress={() => onTabChange("power")}>
          <Rect x={61} y={70} width={38} height={38} rx={8} fill="transparent" />
          <Rect x={65} y={74} width={30} height={30} rx={8} fill={hlFill("power")} stroke={hl("power")} strokeWidth={1.5} />
          <Circle cx={80} cy={89} r={8} fill={hl("power")} opacity={0.3} />
          <Circle cx={80} cy={89} r={5} fill={hl("power")} />
        </G>

        {/* 배터리 하단 — 클릭 시 battery 탭 */}
        <G onPress={() => onTabChange("battery")}>
          <Rect x={50} y={134} width={60} height={34} rx={7} fill="transparent" />
          <Rect x={55} y={138} width={50} height={26} rx={7} fill={hlFill("battery")} stroke={hl("battery")} strokeWidth={1.5} />
          <Rect x={60} y={143} width={32} height={16} rx={4} fill={hl("battery")} opacity={0.2} />
          <Rect x={60} y={143} width={highlight === "battery" ? 24 : 20} height={16} rx={4} fill={hl("battery")} />
        </G>
      </Svg>

      <Text style={illStyles.deviceLabel}>C7 DEVICE</Text>
      <View style={illStyles.shadow} />
    </View>
  );
}

const illStyles = StyleSheet.create({
  wrap: { alignItems: "center", position: "relative", height: 220 },
  deviceLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginTop: -8,
  },
  shadow: {
    width: 100,
    height: 12,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginTop: 4,
  },
});

// ── 드래그 가능한 슬라이더 ────────────────────────────
function DraggableSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  color = COLORS.primary,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  color?: string;
}) {
  const widthRef = useRef(0);
  const pageXRef = useRef(0); // 슬라이더 트랙의 화면상 절대 x 좌표
  const viewRef = useRef<View>(null);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // 터치 시작 시 트랙의 절대 위치 측정
        viewRef.current?.measure((_x, _y, width, _h, pageX) => {
          pageXRef.current = pageX;
          widthRef.current = width;
        });
        const x = evt.nativeEvent.pageX - pageXRef.current;
        const r = Math.max(0, Math.min(1, x / widthRef.current));
        onChange(Math.round(min + r * (max - min)));
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (widthRef.current === 0) return;
        // gestureState.moveX: 절대 화면 좌표 → 트랙 밖으로 나가도 안정적
        const x = gestureState.moveX - pageXRef.current;
        const r = Math.max(0, Math.min(1, x / widthRef.current));
        onChange(Math.round(min + r * (max - min)));
      },
    })
  ).current;

  return (
    <View
      ref={viewRef}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      style={dsStyles.track}
      {...panResponder.panHandlers}
    >
      <View style={[dsStyles.fill, { width: `${ratio * 100}%` as any, backgroundColor: color }]} />
      <View style={[dsStyles.thumb, { left: `${ratio * 100}%` as any, borderColor: color }]} />
    </View>
  );
}

const dsStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: SPACING.lg,
    position: "relative",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 8,
    borderRadius: 4,
  },
  thumb: {
    position: "absolute",
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    marginLeft: -12,
    ...SHADOWS.md,
  },
});

// ── 상태 바 ──────────────────────────────────────────
function StatusBar({
  connected,
  battery,
}: {
  connected: boolean;
  battery: number;
}) {
  return (
    <View style={sbStyles.row}>
      <View style={sbStyles.left}>
        <View
          style={[
            sbStyles.dot,
            {
              backgroundColor: connected
                ? COLORS.connected
                : COLORS.disconnected,
            },
          ]}
        />
        <Text style={sbStyles.text}>{connected ? "연결됨" : "연결 안됨"}</Text>
      </View>
      <Text style={sbStyles.battery}>배터리 {battery}%</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.text },
  battery: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
});

// ── MQTT 연결 카드 ───────────────────────────────────
function MqttCard({ onDisconnect }: { onDisconnect: () => void }) {
  const { device } = useStore();
  return (
    <View style={mqStyles.card}>
      <View style={mqStyles.topRow}>
        <Text style={mqStyles.title}>MQTT CONNECTED</Text>
        <View style={mqStyles.greenDot} />
      </View>
      <Text style={mqStyles.topic}>
        TOPIC: POSTURE/DATA/{device.deviceId ?? "1"}
      </Text>
      <View style={mqStyles.deviceIdBox}>
        <Text style={mqStyles.deviceIdText}>
          Device ID: {device.deviceId ?? "1"}
        </Text>
      </View>
      <TouchableOpacity style={mqStyles.exitBtn} onPress={onDisconnect}>
        <Text style={mqStyles.exitText}>⤷ EXIT MQTT CHANNEL</Text>
      </TouchableOpacity>
      <Text style={mqStyles.versionText}>C7 POSTURE MQTT SYSTEMS V2.1</Text>
    </View>
  );
}
const mqStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: FONTS.sizes.base,
    fontWeight: "900",
    color: "#fff",
    fontStyle: "italic",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  topic: {
    fontSize: FONTS.sizes.xs,
    color: "rgba(255,255,255,0.4)",
    marginBottom: SPACING.sm,
  },
  deviceIdBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.base,
  },
  deviceIdText: { fontSize: FONTS.sizes.sm, fontWeight: "700", color: "#fff" },
  exitBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.3)",
    borderRadius: RADIUS.full,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  exitText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    letterSpacing: 1,
  },
});

// ── 메인 ──────────────────────────────────────────────
export default function DeviceControlScreen() {
  const nav = useNavigation();
  const { device, setDevice, disconnectMqtt, user } = useStore();
  const isGuest = user?.isGuest ?? false;
  const [activeTab, setActiveTab] = useState<Tab>("battery");
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [powerSending, setPowerSending] = useState(false);
  const [powerFeedback, setPowerFeedback] = useState<{ cpu: number; interval: number } | null>(null);

  const handlePowerMode = async (mode: PowerMode) => {
    if (!device.bleDeviceId || powerSending) return;
    setPowerSending(true);
    setPowerFeedback(null);
    try {
      const connected = await connectToDevice(device.bleDeviceId);
      const unsub = subscribePowerStatus(connected, (status: PowerStatus) => {
        unsub();
        setPowerFeedback({ cpu: status.cpu, interval: status.interval });
        saveDevice({
          powerMode: status.mode,
          powerOn: status.mode !== 'off',
          powerSaveMode: status.mode === 'eco',
        });
        setPowerSending(false);
      });
      await sendPowerMode(connected, mode);
    } catch {
      setPowerSending(false);
    }
  };

  const handleChangeWifi = async () => {
    if (!device.bleDeviceId) {
      (nav as any).replace('MqttConnect');
      return;
    }
    try {
      const connected = await connectToDevice(device.bleDeviceId);
      (nav as any).navigate('WifiProvision', { device: connected, mode: 'manage' });
    } catch {
      (nav as any).replace('MqttConnect');
    }
  };

  const handlePrecisionTraining = () => {
    if (!device.deviceId) {
      (nav as any).replace('MqttConnect');
      return;
    }
    (nav as any).navigate('PoseCalibration', { deviceId: device.deviceId, mode: 'training' });
  };

  // 로컬 상태 + Firestore 동시 저장 헬퍼
  const saveDevice = (partial: Parameters<typeof setDevice>[0]) => {
    setDevice(partial);
    if (user?.id) saveDeviceSettings(user.id, partial).catch(() => {});
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "battery", label: "배터리" },
    { key: "power", label: "전원 관리" },
  ];

  const batteryColor =
    device.battery > 30 ? COLORS.warning : COLORS.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* 헤더 */}
      <View style={styles.header}>
        {!isGuest && (
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 19l-7-7 7-7" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>디바이스 제어</Text>
          <Text style={styles.headerSub}>C7 Hardware Interface</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 상태 바 */}
        <StatusBar
          connected={device.mqttStatus === "connected"}
          battery={device.battery}
        />
        {/* 하단 탭 네비게이션 역할 (4개 탭 선택) */}
        <View style={styles.tabBar}>
          {tabs.map((t) => {
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tabItem,
                  activeTab === t.key && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === t.key && styles.tabTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* 기기 일러스트 */}
        <DeviceIllustration highlight={activeTab} onTabChange={setActiveTab} />

        {/* 탭 선택 (하단 스크롤 없이 탭별로 컨텐츠 전환) */}
        <View style={styles.contentCard}>
          {/* ─ 배터리 ─ */}
          {activeTab === "battery" && (
            <>
              <Text style={styles.cardTitle}>배터리</Text>
              <Text style={styles.cardSub}>전력 관리 및 절전 모드</Text>
              <View style={styles.batteryBox}>
                <View style={styles.batteryNumRow}>
                  <Text style={[styles.batteryNum, { color: batteryColor }]}>
                    {device.battery}%
                  </Text>
                  <Text style={[styles.batteryLabel, { color: batteryColor }]}>
                    충전
                  </Text>
                </View>
                <View style={styles.batteryTrack}>
                  <View
                    style={[
                      styles.batteryFill,
                      {
                        width: `${device.battery}%`,
                        backgroundColor: batteryColor,
                      },
                    ]}
                  />
                </View>
              </View>
            </>
          )}

          {/* ─ 전원 관리 ─ */}
          {activeTab === "power" && (
            <>
              <Text style={styles.cardTitle}>전원 관리</Text>
              <Text style={styles.cardSub}>디바이스 모드 제어</Text>
              <View style={styles.powerModeRow}>
                {([
                  { mode: 'on'  as PowerMode, label: '일반', desc: '5초 / 240MHz', color: '#3B82F6' },
                  { mode: 'eco' as PowerMode, label: '절전', desc: '15초 / 80MHz', color: COLORS.primary },
                  { mode: 'off' as PowerMode, label: '끄기', desc: '전송 중단',    color: COLORS.accent },
                ] as const).map(({ mode, label, desc, color }) => {
                  const isActive = device.powerMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.powerModeBtn, isActive && { borderColor: color, backgroundColor: color + '15' }]}
                      onPress={() => handlePowerMode(mode)}
                      disabled={powerSending}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.powerModeBtnLabel, isActive && { color }]}>{label}</Text>
                      <Text style={styles.powerModeBtnDesc}>{desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {powerSending && (
                <View style={styles.powerNote}>
                  <Text style={styles.powerNoteText}>ESP32에 명령 전송 중...</Text>
                </View>
              )}
              {powerFeedback && !powerSending && (
                <View style={styles.powerNote}>
                  <Text style={styles.powerNoteText}>
                    적용됨 — CPU {powerFeedback.cpu}MHz / {powerFeedback.interval}초 간격
                  </Text>
                </View>
              )}
              {!powerSending && !powerFeedback && (
                <View style={styles.powerNote}>
                  <Text style={styles.powerNoteText}>
                    {device.powerMode === 'off'
                      ? '데이터 전송이 중단된 상태입니다.'
                      : device.powerMode === 'eco'
                      ? '절전 모드: 배터리를 아끼며 측정 중입니다.'
                      : '일반 모드: 실시간 자세 측정 중입니다.'}
                  </Text>
                </View>
              )}
            </>
          )}

        </View>

        {/* WiFi 카드 */}
        <View style={styles.wifiCard}>
          <View style={styles.wifiRow}>
            <View>
              <Text style={styles.wifiLabel}>연결된 WiFi</Text>
              <Text style={styles.wifiSsid}>
                {device.connectedSsid ?? '정보 없음'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.wifiChangeBtn}
              onPress={handleChangeWifi}
            >
              <Text style={styles.wifiChangeBtnText}>WiFi 변경</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.trainingCard}>
          <View style={styles.trainingTextWrap}>
            <Text style={styles.trainingLabel}>정밀 자세 학습</Text>
            <Text style={styles.trainingSub}>자세별 데이터를 직접 수집해 분석 정확도를 높입니다.</Text>
          </View>
          <TouchableOpacity
            style={[styles.trainingBtn, !device.deviceId && styles.trainingBtnDisabled]}
            onPress={handlePrecisionTraining}
            disabled={!device.deviceId}
          >
            <Text style={styles.trainingBtnText}>시작</Text>
          </TouchableOpacity>
        </View>

        {/* MQTT 카드 */}
        <MqttCard onDisconnect={() => setShowDisconnect(true)} />
      </ScrollView>

      <ConfirmModal
        visible={showDisconnect}
        icon={
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFE4E8', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12H3m18 0h-2M12 5V3m0 18v-2" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
              <Circle cx="12" cy="12" r="5" stroke={COLORS.accent} strokeWidth="2" />
              <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
            </Svg>
          </View>
        }
        title="MQTT 연결 해제"
        message={
          "디바이스와의 연결을 해제하시겠습니까?\n실시간 자세 측정이 중단됩니다."
        }
        confirmLabel="연결 해제"
        cancelLabel="취소"
        confirmVariant="danger"
        onConfirm={() => {
          if (user?.id && device.deviceId) {
            updateDeviceConnection(user.id, device.deviceId, false).catch(() => {});
          }
          disconnectMqtt();
          setShowDisconnect(false);
          (nav as any).replace("MqttConnect");
        }}
        onCancel={() => setShowDisconnect(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6F8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  infoIcon: { fontSize: 18, color: COLORS.textSecondary },

  contentCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base,
    padding: SPACING.base,
    ...SHADOWS.sm,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.base,
  },

  batteryBox: {
    backgroundColor: "#FFFBEC",
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.base,
  },
  batteryNumRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  batteryNum: { fontSize: FONTS.sizes["4xl"], fontWeight: "800" },
  batteryLabel: { fontSize: FONTS.sizes.base, fontWeight: "600" },
  batteryTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  batteryFill: { height: 8, borderRadius: 4 },

  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  rowLabel: {
    fontSize: FONTS.sizes.base,
    fontWeight: "500",
    color: COLORS.text,
  },

  powerNote: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  powerNoteText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  angleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  angleVal: { fontSize: FONTS.sizes.base, fontWeight: "800" },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.base,
    marginBottom: SPACING.base,
  },
  angleStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  angleStepText: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: "700",
    lineHeight: 22,
  },
  calibBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  calibBtnText: {
    color: "#fff",
    fontSize: FONTS.sizes.base,
    fontWeight: "700",
  },

  vibRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  vibBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  vibBtnActive: {
    backgroundColor: "#EDE9FE",
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
  },
  vibBtnText: {
    fontSize: FONTS.sizes.base,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  vibBtnTextActive: { color: "#8B5CF6" },
  sensorBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  sensorBtnTextActive: { color: COLORS.primary },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.xl,
    padding: 4,
    ...SHADOWS.sm,
  },
  tabItem: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: { backgroundColor: COLORS.bgSecondary },
  tabText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  tabTextActive: { color: COLORS.text },
  tabItemDisabled: { opacity: 0.35 },
  tabTextDisabled: { color: COLORS.textMuted },

  powerModeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  powerModeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.base,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  powerModeBtnLabel: {
    fontSize: FONTS.sizes.base,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  powerModeBtnDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  wifiCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  wifiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wifiLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 2 },
  wifiSsid: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  wifiChangeBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs,
  },
  wifiChangeBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.primary },
  trainingCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.sm,
  },
  trainingTextWrap: { flex: 1, paddingRight: SPACING.md },
  trainingLabel: {
    fontSize: FONTS.sizes.base,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },
  trainingSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  trainingBtn: {
    minWidth: 68,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.base,
  },
  trainingBtnDisabled: { backgroundColor: COLORS.textMuted },
  trainingBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: '#fff' },
});
