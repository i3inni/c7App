import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import Toggle from '../../components/common/Toggle';
import ConfirmModal from '../../components/common/ConfirmModal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { updateNotificationSettings, updateBodyInfo } from '../../services/userService';
import { logout as authLogout, changePassword, deleteAccount } from '../../services/authService';
import { connectToDevice, sendPowerMode } from '../../services/bleService';
import { clearAllStats } from '../../services/statsService';
import { clearNotifications } from '../../services/notificationService';

// ── 공통 헤더 ────────────────────────────────────────
function PageHeader({ title }: { title: string }) {
  const nav = useNavigation();
  return (
    <View style={hStyles.wrap}>
      <TouchableOpacity onPress={() => nav.goBack()} style={hStyles.back}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M19 12H5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 19l-7-7 7-7" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <Text style={hStyles.title}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}
const hStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', padding: SPACING.base },
  back: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  title: { flex: 1, textAlign: 'center', fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
});

// ── 내 정보 ──────────────────────────────────────────
export function MyInfoScreen() {
  const nav = useNavigation();
  const { user, updateSettings, settings, logout, clearRecords, clearNotifications: clearLocalNotifications, device } = useStore();
  const isConnected = device.mqttStatus === 'connected';
  const [showLogout, setShowLogout] = useState(false);
  const [showClearRecords, setShowClearRecords] = useState(false);
  const [showResetZero, setShowResetZero] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="내 정보" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 프로필 */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.profileCard} onPress={() => nav.navigate('LoginSecurity')}>
            <View style={styles.avatar}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.nickname ?? '사용자'} 님</Text>
              <Text style={styles.profileEmail}>{user?.email ?? 'user@example.com'}</Text>
              <View style={styles.connRow}>
                <View style={[styles.connDot, { backgroundColor: isConnected ? COLORS.primary : COLORS.textMuted }]} />
                <Text style={[styles.connText, { color: isConnected ? COLORS.primary : COLORS.textMuted }]}>
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 신체 정보 */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>신체 정보</Text>
            <TouchableOpacity style={styles.rowItem} onPress={() => nav.navigate('BodyInfo')}>
              <Text style={styles.rowLabel}>키</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowVal}>{user?.height ?? 170} cm</Text>
                <Text style={styles.rowArrow}>›</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.rowItem} onPress={() => nav.navigate('BodyInfo')}>
              <Text style={styles.rowLabel}>체중</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowVal}>{user?.weight ?? 65} kg</Text>
                <Text style={styles.rowArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 알림 */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>알림</Text>
            <View style={styles.rowItem}>
              <View>
                <Text style={styles.rowLabel}>자세 알림</Text>
                <Text style={styles.rowSub}>거북목 감지 시 진동</Text>
              </View>
              <Toggle
                value={settings.postureAlertEnabled}
                onToggle={v => {
                  updateSettings({ postureAlertEnabled: v });
                  if (user?.id) updateNotificationSettings(user.id, { postureAlert: v });
                }}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.rowItem}>
              <View>
                <Text style={styles.rowLabel}>리포트 알림</Text>
                <Text style={styles.rowSub}>일일 자세 리포트</Text>
              </View>
              <Toggle
                value={settings.reportAlertEnabled}
                onToggle={v => {
                  updateSettings({ reportAlertEnabled: v });
                  if (user?.id) updateNotificationSettings(user.id, { reportAlert: v });
                }}
              />
            </View>
          </View>
        </View>

        {/* 자세 */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>자세</Text>
            <TouchableOpacity style={styles.rowItem} onPress={() => setShowResetZero(true)}>
              <View style={styles.dangerRow}>
                <View style={styles.resetIconBox}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M7 7a7 7 0 1 1-1.5 7" stroke="#6D5DFB" strokeWidth={2} strokeLinecap="round" />
                    <Path d="M7 7V3M7 7H3" stroke="#6D5DFB" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="12" cy="12" r="2.2" stroke="#6D5DFB" strokeWidth={2} />
                  </Svg>
                </View>
                <View>
                  <Text style={styles.resetLabel}>영점 설정</Text>
                  <Text style={styles.resetSub}>현재 자세를 기준으로 재설정</Text>
                </View>
              </View>
              <Text style={[styles.rowArrow, { color: '#6D5DFB' }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 데이터 */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>데이터</Text>
            <TouchableOpacity style={styles.rowItem} onPress={() => setShowClearRecords(true)}>
              <View style={styles.dangerRow}>
                <View style={styles.dangerIconBox}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2C8.13 2 5 3.34 5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5c0-1.66-3.13-3-7-3z" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M5 5c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View>
                  <Text style={styles.dangerLabel}>기록 초기화</Text>
                  <Text style={styles.dangerSub}>모든 자세 기록 삭제</Text>
                </View>
              </View>
              <Text style={[styles.rowArrow, { color: COLORS.accent }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 로그아웃 */}
        <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.lg }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M16 17l5-5-5-5" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M21 12H9" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => nav.navigate('Withdraw')} style={styles.withdrawBtn}>
          <Text style={styles.withdrawText}>회원 탈퇴</Text>
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity><Text style={styles.footerLink}>이용약관</Text></TouchableOpacity>
          <Text style={styles.footerSep}>｜</Text>
          <TouchableOpacity><Text style={styles.footerLink}>개인정보 처리방침</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showLogout}
        iconNode={
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M16 17l5-5-5-5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M21 12H9" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        }
        title="로그아웃 하시겠습니까?"
        message="다시 로그인하여 사용하실 수 있습니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        confirmVariant="dark"
        onConfirm={async () => {
          try {
            if (device.bleDeviceId) {
              try {
                const ble = await connectToDevice(device.bleDeviceId);
                await sendPowerMode(ble, 'ble_off' as any);
              } catch {}
            }
            await authLogout();
            logout();
            setShowLogout(false);
            (nav as any).replace('Login');
          } catch {
            Alert.alert('오류', '로그아웃에 실패했습니다. 다시 시도해주세요.');
          }
        }}
        onCancel={() => setShowLogout(false)}
      />
      <ConfirmModal
        visible={showClearRecords}
        iconNode={
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M12 2C8.13 2 5 3.34 5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5c0-1.66-3.13-3-7-3z" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5 5c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke={COLORS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        }
        iconBg={COLORS.accentLight}
        title="기록을 초기화하시겠습니까?"
        message={'모든 자세 기록이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'}
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!user?.id) return;
          try {
            await clearAllStats(user.id);
            await clearNotifications(user.id);
            clearRecords();
            clearLocalNotifications();
            setShowClearRecords(false);
          } catch {
            Alert.alert('오류', '기록 초기화에 실패했습니다. 다시 시도해주세요.');
          }
        }}
        onCancel={() => setShowClearRecords(false)}
      />
      <ConfirmModal
        visible={showResetZero}
        iconNode={
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M7 7a7 7 0 1 1-1.5 7" stroke="#6D5DFB" strokeWidth={2} strokeLinecap="round" />
            <Path d="M7 7V3M7 7H3" stroke="#6D5DFB" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="12" cy="12" r="2.2" stroke="#6D5DFB" strokeWidth={2} />
          </Svg>
        }
        iconBg="#F1EFFF"
        title="영점을 재설정 하시겠습니까?"
        message="영점을 재설정 합니다."
        confirmLabel="재설정"
        cancelLabel="취소"
        confirmColor="#6D5DFB"
        onConfirm={() => setShowResetZero(false)}
        onCancel={() => setShowResetZero(false)}
      />
    </SafeAreaView>
  );
}

// ── 신체 정보 ──────────────────────────────────────
export function BodyInfoScreen() {
  const { user, updateUser } = useStore();
  const [showHeight, setShowHeight] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [heightVal, setHeightVal] = useState(String(user?.height ?? 170));
  const [weightVal, setWeightVal] = useState(String(user?.weight ?? 65));

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="신체 정보" />
      <View style={styles.section}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowItem} onPress={() => setShowHeight(true)}>
            <Text style={styles.rowLabel}>키</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowVal}>{user?.height ?? 170} cm</Text>
              <Text style={styles.rowArrow}>›</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.rowItem} onPress={() => setShowWeight(true)}>
            <Text style={styles.rowLabel}>체중</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowVal}>{user?.weight ?? 65} kg</Text>
              <Text style={styles.rowArrow}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 키 바텀시트 */}
      <Modal visible={showHeight} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={bsStyles.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setShowHeight(false); }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={bsStyles.sheet}>
                <View style={bsStyles.handle} />
                <Text style={bsStyles.sheetTitle}>키 설정</Text>
                <TextInput
                  style={bsStyles.input}
                  value={heightVal}
                  onChangeText={setHeightVal}
                  keyboardType="numeric"
                  autoFocus
                />
                <Text style={bsStyles.unit}>cm</Text>
                <Button
                  label="완료"
                  onPress={async () => {
                    const h = Number(heightVal);
                    updateUser({ height: h });
                    setShowHeight(false);
                    Keyboard.dismiss();
                    if (user?.id && user.id !== 'guest') {
                      try { await updateBodyInfo(user.id, { height: h }); }
                      catch { Alert.alert('저장 실패', '키 정보를 저장하지 못했습니다.'); }
                    }
                  }}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* 체중 바텀시트 */}
      <Modal visible={showWeight} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={bsStyles.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setShowWeight(false); }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={bsStyles.sheet}>
                <View style={bsStyles.handle} />
                <Text style={bsStyles.sheetTitle}>체중 설정</Text>
                <TextInput
                  style={bsStyles.input}
                  value={weightVal}
                  onChangeText={setWeightVal}
                  keyboardType="numeric"
                  autoFocus
                />
                <Text style={bsStyles.unit}>kg</Text>
                <Button
                  label="완료"
                  onPress={async () => {
                    const w = Number(weightVal);
                    updateUser({ weight: w });
                    setShowWeight(false);
                    Keyboard.dismiss();
                    if (user?.id && user.id !== 'guest') {
                      try { await updateBodyInfo(user.id, { weight: w }); }
                      catch { Alert.alert('저장 실패', '체중 정보를 저장하지 못했습니다.'); }
                    }
                  }}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const bsStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.lg },
  sheetTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.base },
  input: {
    backgroundColor: COLORS.bgSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.base, fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  unit: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.base },
});

// ── 로그인 및 보안 ────────────────────────────────────
export function LoginSecurityScreen() {
  const nav = useNavigation();
  const { user } = useStore();
  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="로그인 및 보안" />
      <View style={styles.section}>
        <Text style={styles.groupTitle}>계정 정보</Text>
        <View style={styles.card}>
          <View style={styles.rowItem}>
            <View style={styles.iconLabel}>
              <View style={secStyles.mintIconBox}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#0ABFBC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M22 6l-10 7L2 6" stroke="#0ABFBC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View>
                <Text style={styles.rowSubLabel}>기본 이메일</Text>
                <Text style={styles.rowVal}>{user?.email ?? 'user@example.com'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.rowItem} onPress={() => nav.navigate('ChangePassword')}>
            <View style={styles.iconLabel}>
              <View style={secStyles.slateIconBox}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" stroke="#3D4F6B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#3D4F6B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.rowLabel}>비밀번호 변경</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const secStyles = StyleSheet.create({
  mintIconBox: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#E6F9F9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  slateIconBox: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#EDF0F5',
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
});

// ── 비밀번호 변경 ─────────────────────────────────────
export function ChangePasswordScreen() {
  const nav = useNavigation();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleChange = async () => {
    try {
      await changePassword(cur, next);
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      nav.goBack();
    } catch (e: any) {
      const msg = e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'
        ? '현재 비밀번호가 올바르지 않습니다.'
        : '비밀번호 변경에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="비밀번호 변경" />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={pwStyles.hintCard}>
          <Text style={pwStyles.hint}>
            계정 보안을 위해 정기적으로 비밀번호를 변경하는 것을 권장합니다.
          </Text>
        </View>
        <View style={[styles.card, { padding: SPACING.lg }]}>
          <Text style={pwStyles.fieldLabel}>현재 비밀번호</Text>
          <Input
            value={cur} onChangeText={setCur}
            placeholder="현재 비밀번호를 입력하세요"
            secureTextEntry
            style={{ marginBottom: SPACING.lg }}
          />
          <Text style={pwStyles.fieldLabel}>새 비밀번호</Text>
          <Input
            value={next} onChangeText={setNext}
            placeholder="새 비밀번호를 입력하세요"
            secureTextEntry
            style={{ marginBottom: SPACING.lg }}
          />
          <Text style={pwStyles.fieldLabel}>새 비밀번호 확인</Text>
          <Input
            value={confirm} onChangeText={setConfirm}
            placeholder="새 비밀번호를 다시 입력하세요"
            secureTextEntry
          />
        </View>
        <Button
          label="완료"
          onPress={handleChange}
          disabled={!cur || !next || next !== confirm}
          style={{ marginTop: SPACING.base }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const pwStyles = StyleSheet.create({
  hintCard: {
    backgroundColor: '#F0FAFA',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#C8EDED',
    padding: SPACING.base,
    marginBottom: SPACING.base,
  },
  hint: { fontSize: FONTS.sizes.sm, color: '#2A7A7A', lineHeight: 22 },
  fieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
});

// ── 회원 탈퇴 ──────────────────────────────────────────
export function WithdrawScreen() {
  const nav = useNavigation();
  const { logout } = useStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    setLoading(true);
    try {
      await deleteAccount(password || undefined);
      logout();
      (nav as any).replace('Login');
    } catch (e: any) {
      const msg =
        e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'
          ? '비밀번호가 올바르지 않습니다.'
          : e?.message === '비밀번호를 입력해주세요.'
          ? '비밀번호를 입력해주세요.'
          : '회원 탈퇴에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  };

  const items = [
    '모든 자세 기록 및 분석 데이터 삭제',
    '주간 건강 리포트 및 통계 삭제',
    '개인 설정 및 알림 정보 삭제',
    '프리미엄 구독 정보 삭제',
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="회원 탈퇴" />
      <View style={{ flex: 1, padding: SPACING.base }}>
        {/* 경고 */}
        <View style={wdStyles.warnCard}>
          <View style={wdStyles.warnHeader}>
            <View style={wdStyles.warnIconBox}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={COLORS.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M12 9v4" stroke={COLORS.accent} strokeWidth={2} strokeLinecap="round" />
                <Circle cx="12" cy="17" r="1" fill={COLORS.accent} />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={wdStyles.warnTitle}>탈퇴 전에 확인해주세요</Text>
              <Text style={wdStyles.warnDesc}>
                회원 탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              </Text>
            </View>
          </View>
          {items.map((item, i) => (
            <View key={i} style={wdStyles.itemRow}>
              <View style={wdStyles.bullet} />
              <Text style={wdStyles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* 힌트 */}
        <View style={wdStyles.hintCard}>
          <Text style={wdStyles.hintText}>💡 잠깐만요!{'\n'}
            <Text style={wdStyles.hintLink}>일시적으로 사용을 중단하고 싶으시다면 로그아웃 후 다시 돌아오실 수 있습니다.</Text>
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <Text style={pwStyles.fieldLabel}>비밀번호 확인</Text>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="현재 비밀번호를 입력해주세요"
          style={{ marginBottom: SPACING.base }}
        />

        <Button
          label={loading ? '처리 중...' : '탈퇴 진행'}
          onPress={handleWithdraw}
          variant="danger"
          disabled={loading}
          style={{ marginBottom: SPACING.sm }}
        />
        <Button label="취소" onPress={() => nav.goBack()} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}
const wdStyles = StyleSheet.create({
  warnCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.base, ...SHADOWS.md },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  warnIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  warnTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  warnDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.base, lineHeight: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  itemText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  hintCard: { backgroundColor: '#F0FAF4', borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.base },
  hintText: { fontSize: FONTS.sizes.sm, color: '#2D6A4F', fontWeight: '600', lineHeight: 20 },
  hintLink: { color: '#2D6A4F', fontWeight: '400' },
});

// ── 공통 스타일 ───────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.base },
  groupTitle: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, marginLeft: 4 },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.text,
    textShadowColor: COLORS.text,
    textShadowOffset: { width: 0.25, height: 0 },
    textShadowRadius: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  card: { backgroundColor: '#fff', borderRadius: 24, ...SHADOWS.md, overflow: 'hidden' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#fff', borderRadius: 24, padding: SPACING.lg, ...SHADOWS.md,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#5DBD8A', alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  connText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  arrow: { fontSize: 20, color: COLORS.textMuted },

  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  rowLabel: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: '700' },
  rowSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: '400' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rowVal: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
  rowArrow: { fontSize: 18, color: COLORS.textMuted },
  rowIcon: { fontSize: 20, marginRight: SPACING.sm },
  iconLabel: { flexDirection: 'row', alignItems: 'center' },
  rowSubLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  separator: { height: 1, backgroundColor: COLORS.bgSecondary, marginHorizontal: SPACING.lg },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dangerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLabel: { fontSize: FONTS.sizes.md, color: COLORS.accent, fontWeight: '800' },
  dangerSub: { fontSize: FONTS.sizes.xs, color: COLORS.accent, fontWeight: '600', marginTop: 2, opacity: 0.7 },
  resetIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#F1EFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  resetLabel: { fontSize: FONTS.sizes.md, color: '#6D5DFB', fontWeight: '800' },
  resetSub: { fontSize: FONTS.sizes.xs, color: '#6D5DFB', fontWeight: '600', marginTop: 2, opacity: 0.7 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgDark, borderRadius: RADIUS.full,
    height: 52,
  },
  logoutText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: '#fff' },

  withdrawBtn: { alignSelf: 'center', marginTop: SPACING.base },
  withdrawText: { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: '600' },

  footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.base, marginBottom: SPACING.sm },
  footerLink: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  footerSep: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginHorizontal: SPACING.xs },
});
