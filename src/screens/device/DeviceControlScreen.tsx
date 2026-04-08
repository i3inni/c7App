import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Rect, Circle, Ellipse, Path } from "react-native-svg";
import { useStore } from "../../store";
import Toggle from "../../components/common/Toggle";
import ConfirmModal from "../../components/common/ConfirmModal";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from "../../constants/theme";

type Tab = "battery" | "power" | "sensor" | "vibration";

// ── C7 기기 SVG 일러스트 ─────────────────────────────
function DeviceIllustration({ highlight }: { highlight: Tab }) {
  const hl = (tab: Tab) => (highlight === tab ? COLORS.primary : "#9CA3AF");
  const hlFill = (tab: Tab) =>
    highlight === tab ? COLORS.primaryLight : "#F3F4F6";

  return (
    <View style={illStyles.wrap}>
      <Svg width={160} height={200} viewBox="0 0 160 200">
        {/* 몸체 */}
        <Rect
          x={30}
          y={30}
          width={100}
          height={140}
          rx={20}
          fill="#F0F2F5"
          stroke="#D1D5DB"
          strokeWidth={1.5}
        />

        {/* 안테나 */}
        <Rect
          x={50}
          y={10}
          width={6}
          height={28}
          rx={3}
          fill="#D1D5DB"
          transform="rotate(-15 53 24)"
        />
        <Rect
          x={104}
          y={10}
          width={6}
          height={28}
          rx={3}
          fill="#D1D5DB"
          transform="rotate(15 107 24)"
        />

        {/* 센서 (상단) */}
        <Circle
          cx={80}
          cy={65}
          r={12}
          fill={highlight === "sensor" ? COLORS.warning : "#F59E0B"}
          opacity={0.9}
        />
        <Circle
          cx={80}
          cy={65}
          r={7}
          fill={highlight === "sensor" ? "#fff" : "#FFFBEB"}
        />
        {highlight === "sensor" && (
          <Text style={{ position: "absolute" }}>{/* label 별도 */}</Text>
        )}

        {/* 진동 모듈 좌 */}
        <Rect
          x={38}
          y={95}
          width={30}
          height={30}
          rx={8}
          fill={hlFill("vibration")}
          stroke={hl("vibration")}
          strokeWidth={1.5}
        />
        <Circle cx={53} cy={110} r={8} fill={hl("vibration")} opacity={0.3} />
        <Circle cx={53} cy={110} r={5} fill={hl("vibration")} />

        {/* 전원 버튼 우 */}
        <Rect
          x={92}
          y={95}
          width={30}
          height={30}
          rx={8}
          fill={hlFill("power")}
          stroke={hl("power")}
          strokeWidth={1.5}
        />
        <Circle cx={107} cy={110} r={8} fill={hl("power")} opacity={0.3} />
        <Circle cx={107} cy={110} r={5} fill={hl("power")} />

        {/* 배터리 하단 */}
        <Rect
          x={55}
          y={138}
          width={50}
          height={26}
          rx={7}
          fill={hlFill("battery")}
          stroke={hl("battery")}
          strokeWidth={1.5}
        />
        <Rect
          x={60}
          y={143}
          width={32}
          height={16}
          rx={4}
          fill={hl("battery")}
          opacity={0.2}
        />
        <Rect
          x={60}
          y={143}
          width={highlight === "battery" ? 24 : 20}
          height={16}
          rx={4}
          fill={hl("battery")}
        />
      </Svg>

      {/* 라벨 */}
      {highlight === "battery" && (
        <Text style={[illStyles.label, { top: 148, left: 110 }]}>배터리</Text>
      )}
      {highlight === "power" && (
        <Text style={[illStyles.label, { top: 98, left: 110 }]}>전원</Text>
      )}
      {highlight === "sensor" && (
        <Text style={[illStyles.label, { top: 58, left: 100 }]}>센서</Text>
      )}
      {highlight === "vibration" && (
        <Text style={[illStyles.label, { top: 98, left: 14 }]}>진동</Text>
      )}

      <Text style={illStyles.deviceLabel}>C7 DEVICE</Text>
      <View style={illStyles.shadow} />
    </View>
  );
}

const illStyles = StyleSheet.create({
  wrap: { alignItems: "center", position: "relative", height: 220 },
  label: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.accent,
  },
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
  const nav = useNavigation<any>();
  const { device, setDevice, disconnectMqtt } = useStore();
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
    device.battery > 50
      ? COLORS.warning
      : device.battery > 20
        ? COLORS.warning
        : COLORS.accent;

  const batteryLabel =
    device.battery > 60 ? "충분" : device.battery > 30 ? "보통" : "부족";

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>디바이스 제어</Text>
          <Text style={styles.headerSub}>C7 Hardware Interface</Text>
        </View>
        <TouchableOpacity style={styles.infoBtn}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </TouchableOpacity>
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
        <DeviceIllustration highlight={activeTab} />

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
                    {batteryLabel}
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
              {device.powerOn && (
                <View style={styles.activeInfo}>
                  <Text style={styles.activeInfoIcon}>✓</Text>
                  <View>
                    <Text style={styles.activeInfoTitle}>
                      디바이스 활성화됨
                    </Text>
                    <Text style={styles.activeInfoSub}>
                      모든 센서와 모듈이 정상 작동 중입니다
                    </Text>
                  </View>
                </View>
              )}
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
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${(sensorAngle / 90) * 100}%` },
                  ]}
                />
                {/* 실제 슬라이더는 @react-native-community/slider 사용 권장 */}
                <View style={styles.sliderThumb} />
              </View>
              <View style={styles.sliderBtns}>
                <TouchableOpacity
                  onPress={() => setSensorAngle(Math.max(5, sensorAngle - 5))}
                >
                  <Text style={styles.sliderBtn}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSensorAngle(Math.min(90, sensorAngle + 5))}
                >
                  <Text style={styles.sliderBtn}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.calibBtn}>
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
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${vibIntensity}%`, backgroundColor: "#8B5CF6" },
                  ]}
                />
              </View>
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
                      onPress={() => setVibIntensity(v)}
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
        icon="⤷"
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

  activeInfo: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
    backgroundColor: "#EFF8FF",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  activeInfoIcon: { fontSize: 16, color: "#3B82F6", fontWeight: "700" },
  activeInfoTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: "#3B82F6",
  },
  activeInfoSub: { fontSize: FONTS.sizes.xs, color: "#60A5FA", marginTop: 2 },

  angleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  angleVal: { fontSize: FONTS.sizes.base, fontWeight: "800" },
  sliderTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: SPACING.sm,
    position: "relative",
  },
  sliderFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  sliderThumb: {
    position: "absolute",
    right: 0,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  sliderBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.base,
  },
  sliderBtn: {
    fontSize: 22,
    color: COLORS.primary,
    fontWeight: "700",
    padding: SPACING.xs,
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
