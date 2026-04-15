import React, { useState, useRef } from "react";
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

type Tab = "battery" | "power" | "sensor" | "vibration";

// ── C7 기기 SVG 일러스트 ─────────────────────────────
function DeviceIllustration({
  highlight,
  onTabChange,
}: {
  highlight: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const hl = (tab: Tab) => (highlight === tab ? COLORS.primary : "#9CA3AF");
  const hlFill = (tab: Tab) =>
    highlight === tab ? COLORS.primaryLight : "#F3F4F6";

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

        {/* 센서 (상단) — 클릭 시 sensor 탭 */}
        <G onPress={() => onTabChange("sensor")}>
          <Circle cx={80} cy={65} r={16} fill="transparent" />
          <Circle cx={80} cy={65} r={12} fill={hl("sensor")} opacity={0.9} />
          <Circle cx={80} cy={65} r={7} fill={hlFill("sensor")} />
        </G>

        {/* 진동 모듈 좌 — 클릭 시 vibration 탭 */}
        <G onPress={() => onTabChange("vibration")}>
          <Rect x={34} y={91} width={38} height={38} rx={8} fill="transparent" />
          <Rect x={38} y={95} width={30} height={30} rx={8} fill={hlFill("vibration")} stroke={hl("vibration")} strokeWidth={1.5} />
          <Circle cx={53} cy={110} r={8} fill={hl("vibration")} opacity={0.3} />
          <Circle cx={53} cy={110} r={5} fill={hl("vibration")} />
        </G>

        {/* 전원 버튼 우 — 클릭 시 power 탭 */}
        <G onPress={() => onTabChange("power")}>
          <Rect x={88} y={91} width={38} height={38} rx={8} fill="transparent" />
          <Rect x={92} y={95} width={30} height={30} rx={8} fill={hlFill("power")} stroke={hl("power")} strokeWidth={1.5} />
          <Circle cx={107} cy={110} r={8} fill={hl("power")} opacity={0.3} />
          <Circle cx={107} cy={110} r={5} fill={hl("power")} />
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
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (widthRef.current === 0) return;
        const r = Math.max(0, Math.min(1, evt.nativeEvent.locationX / widthRef.current));
        onChange(Math.round(min + r * (max - min)));
      },
      onPanResponderMove: (evt) => {
        if (widthRef.current === 0) return;
        const r = Math.max(0, Math.min(1, evt.nativeEvent.locationX / widthRef.current));
        onChange(Math.round(min + r * (max - min)));
      },
    })
  ).current;

  return (
    <View
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
  const [sensorAngle, setSensorAngle] = useState(device.sensorAngle);
  const [vibIntensity, setVibIntensity] = useState(device.vibrationIntensity);

  const tabs: { key: Tab; label: string }[] = [
    { key: "battery", label: "배터리" },
    { key: "power", label: "전원 관리" },
    { key: "sensor", label: "센서 설정" },
    { key: "vibration", label: "진동 설정" },
  ];

  const batteryColor =
    device.battery > 30 ? COLORS.warning : COLORS.accent;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        {!isGuest && (
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
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
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabItem,
                activeTab === t.key && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab(t.key)}
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
          ))}
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
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>절전 모드</Text>
                <Toggle
                  value={device.powerSaveMode}
                  onToggle={(v) => setDevice({ powerSaveMode: v })}
                  activeColor={COLORS.primary}
                  size="sm"
                />
              </View>
            </>
          )}

          {/* ─ 전원 관리 ─ */}
          {activeTab === "power" && (
            <>
              <Text style={styles.cardTitle}>전원 관리</Text>
              <Text style={styles.cardSub}>디바이스 on/off 제어</Text>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>디바이스 전원</Text>
                <Toggle
                  value={device.powerOn}
                  onToggle={(v) => setDevice({ powerOn: v })}
                  activeColor="#3B82F6"
                />
              </View>
              <View style={styles.powerNote}>
                <Text style={styles.powerNoteText}>
                  {device.powerOn
                    ? '↓ 디바이스 셧다운 시 모든 센서와 모듈 동작이 종료됩니다'
                    : '디바이스가 꺼진 상태입니다. 전원을 켜서 측정을 시작하세요.'}
                </Text>
              </View>
            </>
          )}

          {/* ─ 센서 설정 ─ */}
          {activeTab === "sensor" && (
            <>
              <Text style={styles.cardTitle}>센서 설정</Text>
              <Text style={styles.cardSub}>각도 조정 및 캘리브레이션</Text>
              <View style={styles.angleRow}>
                <Text style={styles.rowLabel}>감지 각도</Text>
                <Text style={[styles.angleVal, { color: COLORS.primary }]}>
                  {sensorAngle}°
                </Text>
              </View>
              <View style={styles.sliderRow}>
                <TouchableOpacity
                  style={styles.angleStepBtn}
                  onPress={() => { const v = Math.max(5, sensorAngle - 5); setSensorAngle(v); setDevice({ sensorAngle: v }); }}
                >
                  <Text style={styles.angleStepText}>−</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <DraggableSlider
                    value={sensorAngle}
                    onChange={(v) => { setSensorAngle(v); setDevice({ sensorAngle: v }); }}
                    min={5}
                    max={90}
                    color={COLORS.primary}
                  />
                </View>
                <TouchableOpacity
                  style={styles.angleStepBtn}
                  onPress={() => { const v = Math.min(90, sensorAngle + 5); setSensorAngle(v); setDevice({ sensorAngle: v }); }}
                >
                  <Text style={styles.angleStepText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.vibRow}>
                {(["약", "중", "강"] as const).map((l, i) => {
                  const v = [20, 30, 45][i];
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[styles.vibBtn, sensorAngle === v && styles.sensorBtnActive]}
                      onPress={() => { setSensorAngle(v); setDevice({ sensorAngle: v }); }}
                    >
                      <Text style={[styles.vibBtnText, sensorAngle === v && styles.sensorBtnTextActive]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[styles.calibBtn, { marginTop: SPACING.lg }]}>
                <Text style={styles.calibBtnText}>캘리브레이션 시작</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ─ 진동 설정 ─ */}
          {activeTab === "vibration" && (
            <>
              <Text style={styles.cardTitle}>진동 모듈</Text>
              <Text style={styles.cardSub}>피드백 강도 조절</Text>
              <View style={styles.rowItem}>
                <Text style={styles.rowLabel}>진동 활성화</Text>
                <Toggle
                  value={device.vibrationEnabled}
                  onToggle={(v) => setDevice({ vibrationEnabled: v })}
                  activeColor="#8B5CF6"
                />
              </View>
              <View style={styles.angleRow}>
                <Text style={styles.rowLabel}>진동 세기</Text>
                <Text style={[styles.angleVal, { color: "#8B5CF6" }]}>
                  {vibIntensity}%
                </Text>
              </View>
              <DraggableSlider
                value={vibIntensity}
                onChange={(v) => { setVibIntensity(v); setDevice({ vibrationIntensity: v }); }}
                min={0}
                max={100}
                color="#8B5CF6"
              />
              <View style={styles.vibRow}>
                {(["약", "중", "강"] as const).map((l, i) => {
                  const v = [33, 66, 100][i];
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[
                        styles.vibBtn,
                        vibIntensity === v && styles.vibBtnActive,
                      ]}
                      onPress={() => { setVibIntensity(v); setDevice({ vibrationIntensity: v }); }}
                    >
                      <Text
                        style={[
                          styles.vibBtnText,
                          vibIntensity === v && styles.vibBtnTextActive,
                        ]}
                      >
                        {l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
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
          disconnectMqtt();
          setShowDisconnect(false);
          nav.replace("MqttConnect");
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  backIcon: { fontSize: 22, color: COLORS.text },
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
});
