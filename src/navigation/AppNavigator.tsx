import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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

import HomeScreen from '../screens/main/HomeScreen';
import StatsScreen from '../screens/main/StatsScreen';
import AIScreen from '../screens/main/AIScreen';
import DeviceControlScreen from '../screens/device/DeviceControlScreen';

import {
  MyInfoScreen, BodyInfoScreen, LoginSecurityScreen,
  ChangePasswordScreen, WithdrawScreen,
} from '../screens/profile/ProfileScreens';

import { COLORS } from '../constants/theme';
import { useStore } from '../store';
import { startPostureListener, getListenerDeviceId } from '../services/mqttService';
import { connectToDevice, sendUserId } from '../services/bleService';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import '../navigation/types'; // 전역 RootParamList 등록

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
    default:
      return null;
  }
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.container, { paddingBottom: insets.bottom + 8 }]}>
      {state.routes.map((route, index: number) => {
        const focused = state.index === index;
        const color = focused ? COLORS.accent : COLORS.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <TabIcon name={route.name} color={color} size={22} />
            <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
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
});

// ── 메인 탭 ──────────────────────────────────────────
function MainTabs() {
  const deviceId    = useStore(s => s.device.deviceId);
  const bleDeviceId = useStore(s => s.device.bleDeviceId);
  const userId      = useStore(s => s.user?.id);

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
    (async () => {
      try {
        const ble = await connectToDevice(bleDeviceId);
        if (cancelled) return;
        await sendUserId(ble, userId);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [bleDeviceId, userId]);

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
