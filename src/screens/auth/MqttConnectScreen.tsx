import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type Step = 'input' | 'connecting' | 'connected';

export default function MqttConnectScreen() {
  const nav = useNavigation<any>();
  const { connectMqtt, setDevice } = useStore();
  const [deviceId, setDeviceId] = useState('');
  const [step, setStep] = useState<Step>('input');

  // Dot animation
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

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

    // 2초 후 연결 완료 시뮬레이션 (실제는 MQTT broker 연결)
    const t = setTimeout(() => {
      anim.stop();
      setDevice({ mqttStatus: 'connected', deviceId });
      nav.replace('MainTabs');
    }, 2000);

    return () => { anim.stop(); clearTimeout(t); };
  }, [step]);

  const handleConnect = () => {
    if (!deviceId) return;
    connectMqtt(deviceId);
    setStep('connecting');
  };

  if (step === 'connecting') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.mainTitle}>MQTT CONNECT</Text>
          <Text style={styles.subTitle}>ENTER DEVICE ID TO JOIN CHANNEL</Text>
        </View>
        <View style={styles.centerArea}>
          {/* Animated circle */}
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
          <Text style={styles.connectingSub}>토픽(posture/data/{deviceId || '1'})을 구독 중입니다.</Text>
        </View>
        <TouchableOpacity style={styles.backToAuth} onPress={() => nav.goBack()}>
          <Text style={styles.backToAuthText}>‹  BACK TO AUTH</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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

        <Text style={styles.inputTitle}>기기 ID 입력</Text>
        <Text style={styles.inputDesc}>
          C7 기기 뒷면에 기재된 고유 ID를 입력하여 실시간 데이터{'\n'}채널에 접속하세요.
        </Text>

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
          label={`CONNECT TO BROKER  →`}
          onPress={handleConnect}
          disabled={!deviceId}
          variant={deviceId ? 'dark' : 'secondary'}
          style={styles.connectBtn}
          textStyle={deviceId ? undefined : { color: COLORS.textMuted }}
        />
      </View>

      <TouchableOpacity style={styles.backToAuth} onPress={() => nav.goBack()}>
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

  inputRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: SPACING.sm },
  inputIcon: { fontSize: 18, marginRight: SPACING.sm },
  deviceInput: { flex: 1 },

  connectBtn: { width: '100%', marginTop: SPACING.sm },
  backToAuth: { alignSelf: 'center', paddingVertical: SPACING.lg },
  backToAuthText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: '600' },

  connectingTitle: { fontSize: FONTS.sizes.xl, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  connectingSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
});
