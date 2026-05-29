import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import {
  SignUpStep1, SignUpStep2, SignUpStep3, SignUpComplete,
} from '../screens/auth/SignUpScreens';
import MqttConnectScreen from '../screens/auth/MqttConnectScreen';
import WifiProvisionScreen from '../screens/auth/WifiProvisionScreen';
import InitBodyInfoScreen from '../screens/auth/InitBodyInfoScreen';
import CalibrationScreen from '../screens/auth/CalibrationScreen';

import HomeScreen from '../screens/main/HomeScreen';
import StatsScreen from '../screens/main/StatsScreen';
import AIScreen from '../screens/main/AIScreen';
import DeviceControlScreen from '../screens/device/DeviceControlScreen';

import {
  MyInfoScreen, BodyInfoScreen, LoginSecurityScreen,
  ChangePasswordScreen, WithdrawScreen,
} from '../screens/profile/ProfileScreens';

import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useStore } from '../store';
import { ADMIN_EMAILS } from '../constants/adminConfig';
import { startPostureListener, getListenerDeviceId } from '../services/mqttService';
import { connectToDevice, sendUserId, subscribeWifiStatus } from '../services/bleService';
import { initConnectionNotifications } from '../services/connectionNotificationService';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import '../navigation/types'; // 전역 RootParamList 등록

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? '';

// ── 탭 SVG 아이콘 ────────────────────────────────────
function TabIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const s = String(size);
  switch (name) {
    case 'HOME':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
            stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
          <Path d="M9 21V12h6v9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'STATS':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth="1.6" />
          <Rect x="10" y="7" width="4" height="14" rx="1" stroke={color} strokeWidth="1.6" />
          <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth="1.6" />
        </Svg>
      );
    case 'AI':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
            stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </Svg>
      );
    case 'CONFIG':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
          <Path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke={color} strokeWidth="1.6"
          />
        </Svg>
      );
    case 'TRAINING':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
            stroke={color} strokeWidth="1.6" />
          <Path d="M10 8l6 4-6 4V8z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

// ── 관리자 정밀 자세 학습 탭 화면 ────────────────────────
function AdminTrainingTabScreen() {
  const nav = useNavigation();
  const device = useStore(s => s.device);
  const user = useStore(s => s.user);
  const [baselinePitch, setBaselinePitch] = useState(['', '', '']);
  const [baselineRoll, setBaselineRoll] = useState(['', '', '']);
  const [height, setHeight] = useState(String(user?.height ?? 175));
  const [weight, setWeight] = useState(String(user?.weight ?? 65));
  const [age, setAge] = useState('25');
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [baselineStatus, setBaselineStatus] = useState('기기 연결 후 저장된 admin 영점값을 불러옵니다.');

  const updateArrayValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const parseValues = (values: string[]) => {
    const parsed = values.map((v) => Number(v.trim()));
    return parsed.every(Number.isFinite) ? parsed : null;
  };

  const formatCalibrationValues = (values: unknown) => {
    if (!Array.isArray(values) || values.length < 3) return null;
    const parsed = values.slice(0, 3).map((v) => Number(v));
    if (!parsed.every(Number.isFinite)) return null;
    return parsed.map((v) => v.toFixed(2));
  };

  const loadAdminBaseline = async () => {
    if (!SERVER_URL) {
      setBaselineStatus('서버 주소가 없어 admin 영점값을 불러올 수 없습니다.');
      return;
    }
    if (!device.deviceId || !user?.id) {
      setBaselineStatus('기기 연결 후 저장된 admin 영점값을 불러옵니다.');
      return;
    }

    setLoadingBaseline(true);
    try {
      const query = `device_id=${encodeURIComponent(device.deviceId)}&user_id=${encodeURIComponent(user.id)}`;
      const res = await fetch(`${SERVER_URL}/calibration?${query}`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 404) {
        setBaselineStatus('저장된 admin 영점값이 없습니다. 현재 센서값을 직접 입력해 저장하세요.');
        return;
      }
      if (!res.ok) {
        throw new Error(data?.detail ?? 'admin 영점값을 불러오지 못했습니다.');
      }

      const p = formatCalibrationValues(data.baseline_pitch);
      const r = formatCalibrationValues(data.baseline_roll);

      if (!p || !r) {
        setBaselineStatus('저장된 영점값 형식이 올바르지 않습니다. 새 값으로 다시 저장하세요.');
        return;
      }

      setBaselinePitch(p);
      setBaselineRoll(r);
      if (Number.isFinite(Number(data.height_cm))) setHeight(String(data.height_cm));
      if (Number.isFinite(Number(data.weight_kg))) setWeight(String(data.weight_kg));
      if (Number.isFinite(Number(data.age))) setAge(String(data.age));
      setBaselineStatus('저장된 admin 영점값을 불러왔습니다. 필요하면 수정 후 다시 저장하세요.');
    } catch (e: any) {
      setBaselineStatus(e?.message ?? 'admin 영점값을 불러오지 못했습니다.');
    } finally {
      setLoadingBaseline(false);
    }
  };

  useEffect(() => {
    loadAdminBaseline();
  }, [device.deviceId, user?.id]);

  const handleSaveBaseline = async () => {
    if (!SERVER_URL) {
      Alert.alert('서버 주소 없음', 'EXPO_PUBLIC_SERVER_URL이 설정되어 있지 않습니다.');
      return;
    }
    if (!device.deviceId) {
      Alert.alert('기기 필요', '먼저 MQTT 기기를 연결해주세요.');
      return;
    }
    if (!user?.id) {
      Alert.alert('로그인 필요', '어드민 계정으로 다시 로그인해주세요.');
      return;
    }

    const p = parseValues(baselinePitch);
    const r = parseValues(baselineRoll);
    const heightCm = Number(height.trim());
    const weightKg = Number(weight.trim());
    const userAge = Number(age.trim());

    if (!p || !r || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || !Number.isFinite(userAge)) {
      Alert.alert('입력 확인', 'C7/T3/T7 pitch·roll, 키, 체중, 나이를 숫자로 입력해주세요.');
      return;
    }

    setSavingBaseline(true);
    try {
      const res = await fetch(`${SERVER_URL}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac: device.deviceId,
          user_id: user.id,
          height_cm: heightCm,
          weight_kg: weightKg,
          age: userAge,
          p,
          r,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail ?? '영점값 저장에 실패했습니다.');
      }
      Alert.alert(
        '영점값 저장 완료',
        `admin 기준 baseline이 업데이트됐습니다.\nBMI ${data.bmi ?? '-'} / 조정량 ${data.total_adj ?? '-'}°`,
      );
      setBaselineStatus('방금 저장한 admin 영점값이 적용됐습니다.');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '서버 요청 중 오류가 발생했습니다.');
    } finally {
      setSavingBaseline(false);
    }
  };

  const handleStart = () => {
    if (!device.deviceId) {
      (nav as any).replace('MqttConnect');
      return;
    }
    (nav as any).navigate('PoseCalibration', { deviceId: device.deviceId, mode: 'training' });
  };

  return (
    <ScrollView style={adminStyles.safe} contentContainerStyle={adminStyles.scroll}>
      <View style={adminStyles.content}>
        <View style={adminStyles.iconWrap}>
          <TabIcon name="TRAINING" color={COLORS.primary} size={48} />
        </View>
        <Text style={adminStyles.title}>정밀 자세 학습</Text>
        <Text style={adminStyles.desc}>
          자세별 데이터를 직접 수집해{'\n'}분석 정확도를 높입니다.
        </Text>
        <TouchableOpacity
          style={[adminStyles.btn, !device.deviceId && adminStyles.btnDisabled]}
          onPress={handleStart}
          disabled={!device.deviceId}
          activeOpacity={0.8}
        >
          <Text style={adminStyles.btnText}>시작</Text>
        </TouchableOpacity>
        {!device.deviceId && (
          <Text style={adminStyles.hint}>기기를 먼저 연결해주세요.</Text>
        )}
      </View>
      <View style={adminStyles.panel}>
        <Text style={adminStyles.panelTitle}>어드민 영점값 입력</Text>
        <Text style={adminStyles.panelDesc}>
          Firestore의 admin UID 캘리브레이션에 직접 저장됩니다.
        </Text>
        <View style={adminStyles.idBox}>
          <Text style={adminStyles.idText}>device: {device.deviceId || '미연결'}</Text>
          <Text style={adminStyles.idText}>admin uid: {user?.id || '없음'}</Text>
        </View>
        <View style={adminStyles.statusRow}>
          <Text style={adminStyles.statusText}>
            {loadingBaseline ? '저장된 admin 영점값을 불러오는 중...' : baselineStatus}
          </Text>
          <TouchableOpacity
            style={adminStyles.reloadBtn}
            onPress={loadAdminBaseline}
            disabled={loadingBaseline}
            activeOpacity={0.8}
          >
            <Text style={adminStyles.reloadText}>새로고침</Text>
          </TouchableOpacity>
        </View>

        <View style={adminStyles.inputHeader}>
          <Text style={adminStyles.sensorLabel}>센서</Text>
          <Text style={adminStyles.axisLabel}>Pitch</Text>
          <Text style={adminStyles.axisLabel}>Roll</Text>
        </View>
        {['C7', 'T3', 'T7'].map((sensor, index) => (
          <View key={sensor} style={adminStyles.inputRow}>
            <Text style={adminStyles.sensorLabel}>{sensor}</Text>
            <TextInput
              value={baselinePitch[index]}
              onChangeText={(text) => updateArrayValue(setBaselinePitch, index, text)}
              placeholder="0.00"
              keyboardType="numbers-and-punctuation"
              style={adminStyles.numberInput}
            />
            <TextInput
              value={baselineRoll[index]}
              onChangeText={(text) => updateArrayValue(setBaselineRoll, index, text)}
              placeholder="0.00"
              keyboardType="numbers-and-punctuation"
              style={adminStyles.numberInput}
            />
          </View>
        ))}

        <View style={adminStyles.profileRow}>
          <TextInput
            value={height}
            onChangeText={setHeight}
            placeholder="키"
            keyboardType="numeric"
            style={adminStyles.profileInput}
          />
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="체중"
            keyboardType="numeric"
            style={adminStyles.profileInput}
          />
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="나이"
            keyboardType="numeric"
            style={adminStyles.profileInput}
          />
        </View>

        <TouchableOpacity
          style={[adminStyles.saveBtn, savingBaseline && adminStyles.btnDisabled]}
          onPress={handleSaveBaseline}
          disabled={savingBaseline}
          activeOpacity={0.8}
        >
          <Text style={adminStyles.btnText}>{savingBaseline ? '저장 중...' : '어드민 영점값 저장'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const adminStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  scroll: { paddingHorizontal: SPACING.base, paddingVertical: 28 },
  content: { alignItems: 'center', paddingHorizontal: SPACING.base },
  iconWrap: { marginBottom: 20 },
  title: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  desc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
  },
  btnDisabled: { backgroundColor: COLORS.textMuted },
  btnText: { fontSize: FONTS.sizes.base, fontWeight: '800', color: '#fff' },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 14 },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  panelTitle: { fontSize: FONTS.sizes.base, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  panelDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 14 },
  idBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  idText: { fontSize: 11, color: '#9A3412', fontWeight: '700', lineHeight: 17 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  statusText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 17 },
  reloadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8F3EF',
  },
  reloadText: { fontSize: FONTS.sizes.xs, fontWeight: '800', color: COLORS.accent },
  inputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sensorLabel: { width: 44, fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text },
  axisLabel: { flex: 1, fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textMuted, textAlign: 'center' },
  numberInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginLeft: 8,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  profileRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 14 },
  profileInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
});

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const powerOn = useStore(s => s.device.powerOn);
  return (
    <View style={[tabStyles.container, { paddingBottom: insets.bottom + 8 }]}>
      {state.routes.map((route, index: number) => {
        const focused = state.index === index;
        const isConfigDisabled = route.name === 'CONFIG' && !powerOn;
        const color = isConfigDisabled
          ? '#C9CFD8'
          : focused
            ? COLORS.accent
            : COLORS.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.tab}
            onPress={() => {
              if (isConfigDisabled) {
                Alert.alert('전원 꺼짐', '기기 전원이 꺼져 있어 CONFIG 탭에 들어갈 수 없습니다.');
                return;
              }
              navigation.navigate(route.name);
            }}
            activeOpacity={0.7}
          >
            <TabIcon name={route.name} color={color} size={22} />
            <Text style={[tabStyles.label, focused && !isConfigDisabled && tabStyles.labelActive, isConfigDisabled && tabStyles.labelDisabled]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingBottom: 0,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 3 },
  labelActive: { color: COLORS.accent },
  labelDisabled: { color: '#C9CFD8' },
});

// ── 메인 탭 ──────────────────────────────────────────
function MainTabs() {
  const deviceId    = useStore(s => s.device.deviceId);
  const bleDeviceId = useStore(s => s.device.bleDeviceId);
  const userId      = useStore(s => s.user?.id);
  const userEmail   = useStore(s => s.user?.email);
  const setDevice   = useStore(s => s.setDevice);
  const isAdmin     = ADMIN_EMAILS.includes(userEmail ?? '');

  // 앱 재시작 후 Firestore 리스너 재연결
  useEffect(() => {
    if (deviceId && userId && getListenerDeviceId() !== deviceId) {
      startPostureListener(deviceId, userId);
    }
  }, [deviceId, userId]);

  // BLE 자동 재연결 (실패해도 MQTT/Firestore로 동작하므로 무시)
  useEffect(() => {
    if (!bleDeviceId || !userId) return;
    let cancelled = false;
    let unsubWifiStatus: (() => void) | null = null;
    (async () => {
      try {
        const ble = await connectToDevice(bleDeviceId);
        if (cancelled) return;
        await sendUserId(ble, userId);
        unsubWifiStatus = subscribeWifiStatus(ble, (event) => {
          if (event.type === 'connected') {
            setDevice({ connectedSsid: event.ssid, wifiConnected: true });
            // WiFi 재연결 시 Firestore 리스너 재시작
            const { device: d, user: u } = useStore.getState();
            if (d.deviceId && u?.id) startPostureListener(d.deviceId, u.id);
            return;
          }
          if (event.type === 'disconnected') {
            setDevice({ connectedSsid: null, wifiConnected: false, mqttStatus: 'disconnected' });
            // Firestore 리스너는 유지 — onSnapshot이 자동으로 재연결 처리
            return;
          }
          if (event.type === 'success') {
            setDevice({ wifiConnected: true });
            return;
          }
          if (event.type === 'fail') {
            setDevice({ wifiConnected: false, connectedSsid: null });
          }
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      unsubWifiStatus?.();
    };
  }, [bleDeviceId, userId, setDevice]);

  if (isAdmin) {
    return (
      <Tab.Navigator
        tabBar={props => <TabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="TRAINING" component={AdminTrainingTabScreen} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HOME" component={HomeScreen} />
      <Tab.Screen name="STATS" component={StatsScreen} />
      <Tab.Screen name="AI" component={AIScreen} />
      <Tab.Screen name="CONFIG" component={DeviceControlScreen} />
    </Tab.Navigator>
  );
}

// ── 루트 스택 ─────────────────────────────────────────
export default function AppNavigator() {
  useEffect(() => {
    initConnectionNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
          {/* Splash */}
          <Stack.Screen name="Splash" component={SplashScreen} />

          {/* Auth */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUpStep1" component={SignUpStep1} />
          <Stack.Screen name="SignUpStep2" component={SignUpStep2 as any} />
          <Stack.Screen name="SignUpStep3" component={SignUpStep3 as any} />
          <Stack.Screen name="SignUpComplete" component={SignUpComplete as any} />
          <Stack.Screen name="MqttConnect" component={MqttConnectScreen} />
          <Stack.Screen name="WifiProvision" component={WifiProvisionScreen as any} />
          <Stack.Screen name="InitBodyInfo" component={InitBodyInfoScreen} />
          <Stack.Screen name="PoseCalibration" component={CalibrationScreen} />

          {/* Main */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="GuestDevice" component={DeviceControlScreen} options={{ gestureEnabled: false }} />

          {/* Profile */}
          <Stack.Screen name="MyInfo" component={MyInfoScreen} />
          <Stack.Screen name="BodyInfo" component={BodyInfoScreen} />
          <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
