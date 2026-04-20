import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Device } from 'react-native-ble-plx';
import { useStore } from '../../store';
import { saveNotification } from '../../services/notificationService';
import { updateDeviceConnection } from '../../services/deviceService';
import {
  requestBluetoothPermissions, startScan, stopScan,
} from '../../services/bleService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type Step = 'input' | 'scanning' | 'connecting' | 'error';
type ErrorType = 'timeout' | 'auth' | 'network' | 'ble';

const CONNECT_TIMEOUT_MS = 10000;
const DEMO_DEVICE_ID = 'C7-DEMO-2024';

export default function MqttConnectScreen() {
  const nav = useNavigation();
  const { connectMqtt, setDevice, user } = useStore();
  const isGuest = user?.isGuest ?? false;
  const [deviceId, setDeviceId] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [bleDevices, setBleDevices] = useState<Device[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  // BLE 스캔 시작
  const handleBleScan = async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      setErrorType('ble');
      setStep('error');
      return;
    }
    setBleDevices([]);
    setStep('scanning');

    startScan(
      (device) => {
        if (!device.name) return;
        setBleDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      },
      () => {
        stopScan();
        setErrorType('ble');
        setStep('error');
      },
    );

    // 10초 후 자동 스캔 중단
    scanTimerRef.current = setTimeout(() => {
      stopScan();
    }, 10000);
  };

  // BLE 기기 선택 → 해당 기기 ID로 연결
  const handleSelectDevice = (device: Device) => {
    stopScan();
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setDeviceId(device.id);
    connectMqtt(device.id);
    setStep('connecting');
  };

  useEffect(() => {
    return () => {
      stopScan();
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  // connecting 단계 애니메이션 + 시뮬레이션
  useEffect(() => {
    if (step !== 'connecting') return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();

    const t = setTimeout(() => {
      anim.stop();
      setDevice({ mqttStatus: 'error' });
      setErrorType('timeout');
      setStep('error');
    }, CONNECT_TIMEOUT_MS);

    // 개발용 시뮬레이션: 2초 후 성공 처리
    const sim = setTimeout(() => {
      clearTimeout(t);
      anim.stop();
      const connectedId = deviceId || DEMO_DEVICE_ID;
      setDevice({ mqttStatus: 'connected', deviceId: connectedId });
      if (user?.id) {
        updateDeviceConnection(user.id, connectedId, true).catch(() => {});
        saveNotification(user.id, {
          category: 'device',
          title: '기기 연결 완료',
          body: `C7 기기(${connectedId})가 정상적으로 연결되었습니다.`,
        }).catch(() => {});
      }
      const nextScreen = isGuest ? 'GuestDevice' : (!user?.height || !user?.weight) ? 'InitBodyInfo' : 'MainTabs';
      (nav as any).replace(nextScreen);
    }, 2000);

    return () => { anim.stop(); clearTimeout(t); clearTimeout(sim); };
  }, [step]);

  const handleConnect = () => {
    if (!deviceId.trim()) return;
    connectMqtt(deviceId);
    setStep('connecting');
  };

  const handleRetry = () => {
    dot1.setValue(0);
    dot2.setValue(0);
    setErrorType(null);
    setStep('input');
  };

  // 데모 모드: 기기 없이 홈으로 바로 이동
  const handleDemoSkip = () => {
    setDevice({ mqttStatus: 'connected', deviceId: DEMO_DEVICE_ID });
    if (user?.id) {
      updateDeviceConnection(user.id, DEMO_DEVICE_ID, true).catch(() => {});
    }
    const nextScreen = isGuest ? 'GuestDevice' : (!user?.height || !user?.weight) ? 'InitBodyInfo' : 'MainTabs';
    (nav as any).replace(nextScreen);
  };

  const errorMessage: Record<ErrorType, string> = {
    timeout: '연결 시간이 초과되었습니다.\n기기가 켜져 있는지 확인해주세요.',
    auth: '기기 ID가 올바르지 않습니다.\nC7 기기 뒷면의 ID를 확인해주세요.',
    network: '네트워크 연결을 확인해주세요.\nWi-Fi 또는 데이터가 필요합니다.',
    ble: '블루투스 권한이 필요하거나\n블루투스가 꺼져 있습니다.',
  };

  // ── 에러 화면 ─────────────────────────────────────
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.mainTitle}>MQTT CONNECT</Text>
          <Text style={styles.subTitle}>ENTER DEVICE ID TO JOIN CHANNEL</Text>
        </View>
        <View style={styles.centerArea}>
          <View style={[styles.outerCircle, { borderColor: COLORS.accent }]}>
            <View style={styles.cloudCard}>
              <Text style={styles.cloudIcon}>⚠️</Text>
              <Text style={[styles.syncLabel, { color: COLORS.accent }]}>ERROR</Text>
            </View>
          </View>
          <Text style={[styles.connectingTitle, { color: COLORS.accent }]}>연결 실패</Text>
          <Text style={[styles.connectingSub, { textAlign: 'center', lineHeight: 22 }]}>
            {errorMessage[errorType ?? 'timeout']}
          </Text>
          <Button
            label="다시 시도  →"
            onPress={handleRetry}
            style={{ width: '100%', marginTop: SPACING.xl }}
          />
        </View>
        <TouchableOpacity style={styles.demoBtn} onPress={handleDemoSkip}>
          <Text style={styles.demoBtnText}>[데모] 기기 없이 홈으로 이동</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── 연결 중 화면 ──────────────────────────────────
  if (step === 'connecting') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.mainTitle}>MQTT CONNECT</Text>
          <Text style={styles.subTitle}>ENTER DEVICE ID TO JOIN CHANNEL</Text>
        </View>
        <View style={styles.centerArea}>
          <View style={styles.outerCircle}>
            <Animated.View style={[styles.dot, styles.dot1, {
              opacity: dot1, transform: [{ scale: dot1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]
            }]} />
            <Animated.View style={[styles.dot, styles.dot2, {
              opacity: dot2, transform: [{ scale: dot2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]
            }]} />
            <View style={styles.cloudCard}>
              <Text style={styles.cloudIcon}>☁️</Text>
              <Text style={styles.syncLabel}>SYNCING</Text>
            </View>
          </View>
          <Text style={styles.connectingTitle}>CONNECTING BROKER...</Text>
          <Text style={styles.connectingSub}>토픽(posture/data/{deviceId || DEMO_DEVICE_ID})을 구독 중입니다.</Text>
        </View>
        <TouchableOpacity style={styles.backToAuth} onPress={() => (nav as any).replace('Login')}>
          <Text style={styles.backToAuthText}>‹  BACK TO AUTH</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── BLE 스캔 화면 ─────────────────────────────────
  if (step === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.mainTitle}>MQTT CONNECT</Text>
          <Text style={styles.subTitle}>SELECT YOUR C7 DEVICE</Text>
        </View>
        <View style={styles.scanArea}>
          <View style={styles.scanHeader}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.scanTitle}>  주변 BLE 기기 검색 중...</Text>
          </View>
          {bleDevices.length === 0 ? (
            <Text style={styles.scanEmpty}>주변에서 기기를 찾고 있습니다.</Text>
          ) : (
            <FlatList
              data={bleDevices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.deviceItem} onPress={() => handleSelectDevice(item)}>
                  <Text style={styles.deviceName}>{item.name ?? '알 수 없는 기기'}</Text>
                  <Text style={styles.deviceAddr}>{item.id}</Text>
                  <Text style={styles.deviceRssi}>RSSI {item.rssi ?? '-'} dBm  ›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.demoBtn} onPress={handleDemoSkip}>
            <Text style={styles.demoBtnText}>[데모] 기기 없이 홈으로 이동</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backToAuth} onPress={() => { stopScan(); setStep('input'); }}>
            <Text style={styles.backToAuthText}>‹  수동 입력으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 기본 입력 화면 ────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.mainTitle}>MQTT CONNECT</Text>
        <Text style={styles.subTitle}>ENTER DEVICE ID TO JOIN CHANNEL</Text>
      </View>

      <View style={styles.centerArea}>
        <View style={styles.outerCircle}>
          <View style={styles.keyCard}>
            <Text style={styles.keyIcon}>🔑</Text>
          </View>
        </View>

        <Text style={styles.inputTitle}>기기 연결</Text>
        <Text style={styles.inputDesc}>
          BLE로 C7 기기를 자동 검색하거나{'\n'}기기 ID를 직접 입력하세요.
        </Text>

        <Button
          label="BLE 기기 자동 검색  →"
          onPress={handleBleScan}
          style={{ width: '100%', marginBottom: SPACING.md }}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는 직접 입력</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>📱</Text>
          <Input
            value={deviceId}
            onChangeText={setDeviceId}
            placeholder="Device ID (ex: C7-X1-2024)"
            style={styles.deviceInput}
          />
        </View>

        <Button
          label="CONNECT TO BROKER  →"
          onPress={handleConnect}
          disabled={!deviceId.trim()}
          variant={deviceId.trim() ? 'dark' : 'secondary'}
          style={styles.connectBtn}
          textStyle={deviceId.trim() ? undefined : { color: COLORS.textMuted }}
        />
      </View>

      <TouchableOpacity style={styles.demoBtn} onPress={handleDemoSkip}>
        <Text style={styles.demoBtnText}>[데모] 기기 없이 홈으로 이동</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backToAuth} onPress={() => (nav as any).replace('Login')}>
        <Text style={styles.backToAuthText}>‹  BACK TO AUTH</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  mainTitle: { fontSize: FONTS.sizes['2xl'], fontWeight: '900', color: COLORS.text, fontStyle: 'italic' },
  subTitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 1, marginTop: 2 },

  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },

  outerCircle: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl,
  },
  keyCard: {
    width: 72, height: 72, borderRadius: RADIUS.xl,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.md,
  },
  keyIcon: { fontSize: 32 },
  cloudCard: {
    width: 72, height: 72, borderRadius: RADIUS.xl,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.md,
  },
  cloudIcon: { fontSize: 28 },
  syncLabel: { fontSize: 9, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.5, marginTop: 2 },

  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot1: { top: 20, right: 30, backgroundColor: COLORS.primary },
  dot2: { bottom: 35, left: 20, backgroundColor: COLORS.accent },

  inputTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  inputDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },

  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: SPACING.md },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginHorizontal: SPACING.sm },

  inputRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: SPACING.sm },
  inputIcon: { fontSize: 18, marginRight: SPACING.sm },
  deviceInput: { flex: 1 },

  connectBtn: { width: '100%', marginTop: SPACING.sm },

  // BLE 스캔 영역
  scanArea: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  scanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  scanTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  scanEmpty: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl },
  deviceItem: {
    backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  deviceName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  deviceAddr: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2, fontFamily: 'monospace' },
  deviceRssi: { fontSize: FONTS.sizes.xs, color: COLORS.primary, marginTop: 4, textAlign: 'right' },

  bottomArea: { paddingBottom: SPACING.sm },

  // 데모 버튼
  demoBtn: { alignSelf: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    backgroundColor: '#FFF3CD', borderRadius: RADIUS.md, marginBottom: 4 },
  demoBtnText: { fontSize: FONTS.sizes.sm, color: '#856404', fontWeight: '700' },

  backToAuth: { alignSelf: 'center', paddingVertical: SPACING.lg },
  backToAuthText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },

  connectingTitle: { fontSize: FONTS.sizes.xl, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  connectingSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
});
