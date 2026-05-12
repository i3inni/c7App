import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path, Line } from 'react-native-svg';
import { Device } from 'react-native-ble-plx';
import {
  subscribeWifiStatus, sendWifiCredentials, triggerWifiScan, subscribeWifiList,
  readDeviceId, sendUserId, sendDisconnectCommand, WifiNetwork,
} from '../../services/bleService';
import { startPostureListener, stopPostureListener } from '../../services/mqttService';
import { useStore } from '../../store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type Status = 'scanning' | 'idle' | 'sending' | 'disconnecting' | 'success' | 'fail';
type RouteParams = { device: Device; mode?: 'setup' | 'manage' };

export default function WifiProvisionScreen() {
  const nav    = useNavigation();
  const route  = useRoute<RouteProp<{ WifiProvision: RouteParams }, 'WifiProvision'>>();
  const { device, mode = 'setup' } = route.params;
  const { setDevice, user } = useStore();

  const [wifiList, setWifiList]               = useState<WifiNetwork[]>([]);
  const [selected, setSelected]               = useState('');
  const [selectedSecured, setSelectedSecured] = useState(false);
  const [password, setPassword]               = useState('');
  const [showPass, setShowPass]               = useState(false);
  const [status, setStatus]                   = useState<Status>('scanning');
  const [currentSsid, setCurrentSsid]         = useState<string | null>(useStore.getState().device.connectedSsid);
  const selectedRef = useRef('');

  useEffect(() => {
    console.log('[WiFi] 화면 마운트, mode:', mode, 'device:', device.id);

    triggerWifiScan(device).catch(() => {});

    const unsubList = subscribeWifiList(device, (networks) => {
      console.log('[WiFi] 목록 수신:', networks.map(n => `${n.ssid}(${n.secured ? '잠김' : '열림'})`).join(', '));
      if (networks.length > 0) {
        setWifiList(networks);
        setStatus('idle');
      }
    });

    const unsubStatus = subscribeWifiStatus(device, async (event) => {
      console.log('[WiFi] 상태 수신:', event);

      if (event.type === 'connected') {
        // BLE 연결 시 ESP32가 현재 연결 상태 전송
        setCurrentSsid(event.ssid);
        setDevice({ connectedSsid: event.ssid });
        if (status === 'scanning') setStatus('idle');
        return;
      }

      if (event.type === 'disconnected') {
        setCurrentSsid(null);
        setDevice({ connectedSsid: undefined, mqttStatus: 'disconnected' });
        stopPostureListener();
        setStatus('idle');
        return;
      }

      if (event.type === 'success') {
        setStatus('success');
        console.log('[WiFi] 연결 성공, deviceId 읽기 시도...');
        let deviceId: string | undefined;
        try {
          deviceId = await readDeviceId(device);
          console.log('[WiFi] deviceId:', deviceId);
        } catch (e) {
          console.warn('[WiFi] deviceId 읽기 실패:', e);
        }
        if (user?.id) {
          try {
            await sendUserId(device, user.id);
          } catch (e) {
            console.warn('[WiFi] userId 전송 실패:', e);
          }
        }
        setDevice({
          connectedSsid: selectedRef.current,
          ...(deviceId ? { deviceId } : {}),
        });
        setCurrentSsid(selectedRef.current);
        if (deviceId) startPostureListener(deviceId, user?.id ?? 'unknown');

        if (mode === 'setup') {
          setTimeout(() => (nav as any).replace('MainTabs'), 1500);
        } else {
          // 관리 모드: 연결 성공 후 화면에 머물기
          setTimeout(() => {
            setSelected('');
            setPassword('');
            setStatus('idle');
          }, 1500);
        }
        return;
      }

      if (event.type === 'fail') {
        setStatus('fail');
      }
    });

    return () => { unsubList(); unsubStatus(); };
  }, [device]);

  const handleRescan = async () => {
    console.log('[WiFi] 재스캔 요청');
    setWifiList([]);
    setSelected('');
    setStatus('scanning');
    try {
      await triggerWifiScan(device);
    } catch (e) {
      console.warn('[WiFi] 재스캔 실패:', e);
      setStatus('idle');
    }
  };

  const handleConnect = async () => {
    if (!selected) return;
    if (selectedSecured && !password) return;
    console.log(`[WiFi] 연결 시도: SSID="${selected}", secured=${selectedSecured}`);
    Keyboard.dismiss();
    setStatus('sending');
    try {
      await sendWifiCredentials(device, selected, password);
      console.log('[WiFi] 자격증명 전송 완료, ESP32 응답 대기 중...');
    } catch (e) {
      console.error('[WiFi] 자격증명 전송 실패:', e);
      setStatus('fail');
    }
  };

  const handleDisconnect = async () => {
    console.log('[WiFi] 연결 끊기 요청');
    setStatus('disconnecting');
    try {
      await sendDisconnectCommand(device);
    } catch (e) {
      console.warn('[WiFi] 연결 끊기 실패:', e);
      setStatus('idle');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 19l-7-7 7-7" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.title}>{mode === 'manage' ? 'WiFi 관리' : 'WiFi 설정'}</Text>
            <Text style={s.subtitle}>
              {mode === 'manage' ? '연결 변경 또는 해제' : '연결할 네트워크를 선택하세요'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleRescan}
            style={[s.backBtn, (status === 'scanning' || status === 'sending') && s.scanBtnDisabled]}
            disabled={status === 'scanning' || status === 'sending'}
          >
            {status === 'scanning'
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M1 4v6h6"
                    stroke={COLORS.primary} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Path
                    d="M3.51 15a9 9 0 1 0 .49-4.95L1 10"
                    stroke={COLORS.primary} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              )
            }
          </TouchableOpacity>
        </View>

        {/* 현재 연결 상태 카드 (관리 모드 or 연결 정보 있을 때) */}
        {currentSsid && (
          <View style={s.currentCard}>
            <View style={s.currentLeft}>
              <View style={s.connectedDot} />
              <View>
                <Text style={s.currentLabel}>현재 연결됨</Text>
                <Text style={s.currentSsid}>{currentSsid}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.disconnectBtn, status === 'disconnecting' && s.disconnectBtnDisabled]}
              onPress={handleDisconnect}
              disabled={status === 'disconnecting'}
            >
              {status === 'disconnecting'
                ? <ActivityIndicator size="small" color={COLORS.accent} />
                : <Text style={s.disconnectBtnText}>연결 끊기</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* 스캔 중 */}
        {status === 'scanning' && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={s.scanText}>WiFi 목록 불러오는 중...</Text>
          </View>
        )}

        {/* 다시 검색 버튼 */}
        {status !== 'scanning' && (
          <TouchableOpacity onPress={handleRescan} style={s.rescanBtn} disabled={status === 'sending'}>
            <Text style={s.rescanText}>↻ 다시 검색</Text>
          </TouchableOpacity>
        )}

        {/* WiFi 목록 */}
        {status !== 'scanning' && (
          <FlatList
            data={wifiList}
            keyExtractor={item => item.ssid}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>주변 WiFi가 없습니다</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = selected === item.ssid;
              const isCurrent  = currentSsid === item.ssid;
              const stroke = isSelected ? COLORS.primary : COLORS.textMuted;
              return (
                <TouchableOpacity
                  style={[s.item, isSelected && s.itemSelected, isCurrent && s.itemCurrent]}
                  onPress={() => {
                    setSelected(item.ssid);
                    setSelectedSecured(item.secured);
                    selectedRef.current = item.ssid;
                    setPassword('');
                  }}
                  activeOpacity={0.7}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
                    <Path d="M1.42 9a16 16 0 0 1 21.16 0" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                    <Path d="M5 12.55a11 11 0 0 1 14.08 0" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                    <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                    <Line x1="12" y1="20" x2="12.01" y2="20" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                  </Svg>

                  <Text style={[s.itemText, isSelected && s.itemTextSelected]}>
                    {item.ssid}
                    {isCurrent && <Text style={s.currentBadge}> 연결됨</Text>}
                  </Text>

                  {item.secured && (
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z"
                        stroke={isSelected ? COLORS.primary : COLORS.textMuted} strokeWidth={2} />
                      <Path d="M7 11V7a5 5 0 0 1 10 0v4"
                        stroke={isSelected ? COLORS.primary : COLORS.textMuted} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  )}

                  {isSelected && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 6L9 17l-5-5" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* 하단: 선택된 네트워크 연결 패널 */}
        {selected !== '' && status !== 'scanning' && (
          <View style={s.bottom}>
            <Text style={s.selectedLabel}>
              선택된 네트워크: <Text style={s.selectedSsid}>{selected}</Text>
            </Text>

            {selectedSecured && (
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="비밀번호"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} style={s.eyeBtn}>
                  <Text style={s.eyeText}>{showPass ? '숨김' : '표시'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[s.btn, ((selectedSecured && !password) || status === 'sending') && s.btnDisabled]}
              onPress={handleConnect}
              disabled={(selectedSecured && !password) || status === 'sending'}
              activeOpacity={0.8}
            >
              {status === 'sending'
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>연결</Text>
              }
            </TouchableOpacity>

            {status === 'success' && (
              <View style={s.resultBox}>
                <Text style={s.successText}>
                  {mode === 'setup' ? '✓ WiFi 연결 성공! 이동 중...' : '✓ WiFi 변경 완료!'}
                </Text>
              </View>
            )}
            {status === 'fail' && (
              <View style={[s.resultBox, s.failBox]}>
                <Text style={s.failText}>연결 실패. 네트워크를 확인하세요.</Text>
                <TouchableOpacity onPress={() => setStatus('idle')}>
                  <Text style={s.retryText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F5F6F8' },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:   { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
  subtitle:{ fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  currentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', marginHorizontal: SPACING.base, marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg, padding: SPACING.base,
    borderWidth: 1.5, borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  currentLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  connectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  currentLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  currentSsid:  { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  disconnectBtn: {
    borderWidth: 1.5, borderColor: COLORS.accent,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs,
    minWidth: 80, alignItems: 'center',
  },
  disconnectBtnDisabled: { borderColor: COLORS.textMuted },
  disconnectBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.accent },

  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanText: { marginTop: SPACING.base, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

  list: { padding: SPACING.base, paddingBottom: SPACING.xl },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: SPACING.base, marginBottom: SPACING.sm,
    borderWidth: 1.5, borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  itemSelected:     { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  itemCurrent:      { borderColor: COLORS.primary + '60' },
  itemText:         { fontSize: FONTS.sizes.base, color: COLORS.text, flex: 1 },
  itemTextSelected: { color: COLORS.primary, fontWeight: '600' },
  currentBadge:     { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '400' },

  emptyBox:  { alignItems: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },

  bottom: {
    backgroundColor: '#fff', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  selectedLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  selectedSsid:  { fontWeight: '700', color: COLORS.text },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6F8', borderRadius: RADIUS.lg, marginBottom: SPACING.base },
  input:  { flex: 1, padding: SPACING.base, fontSize: FONTS.sizes.base, color: COLORS.text },
  eyeBtn: { paddingHorizontal: SPACING.base },
  eyeText:{ fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },

  btn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center' },
  btnDisabled: { backgroundColor: COLORS.textMuted },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: FONTS.sizes.base },

  scanBtnDisabled: { opacity: 0.4 },
  rescanBtn:   { alignSelf: 'flex-end', marginHorizontal: SPACING.base, marginBottom: SPACING.xs, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, backgroundColor: '#fff', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  rescanText:  { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },

  resultBox:   { marginTop: SPACING.base, padding: SPACING.base, borderRadius: RADIUS.md, backgroundColor: '#D1FAE5', alignItems: 'center' },
  failBox:     { backgroundColor: '#FEE2E2' },
  successText: { color: '#065F46', fontWeight: '600' },
  failText:    { color: '#991B1B', fontWeight: '600', marginBottom: SPACING.xs },
  retryText:   { color: COLORS.accent, fontSize: FONTS.sizes.sm, fontWeight: '600' },
});
