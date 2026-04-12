import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store';
import Toggle from '../../components/common/Toggle';
import ConfirmModal from '../../components/common/ConfirmModal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

// ── 공통 헤더 ────────────────────────────────────────
function PageHeader({ title }: { title: string }) {
  const nav = useNavigation();
  return (
    <View style={hStyles.wrap}>
      <TouchableOpacity onPress={() => nav.goBack()} style={hStyles.back}>
        <Text style={hStyles.backIcon}>‹</Text>
      </TouchableOpacity>
      <Text style={hStyles.title}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}
const hStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', padding: SPACING.base },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: COLORS.text },
  title: { flex: 1, textAlign: 'center', fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
});

// ── 내 정보 ──────────────────────────────────────────
export function MyInfoScreen() {
  const nav = useNavigation();
  const { user, updateUser, updateSettings, settings, logout, clearRecords } = useStore();
  const [showLogout, setShowLogout] = useState(false);
  const [showClearRecords, setShowClearRecords] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="내 정보" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 프로필 */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.profileCard} onPress={() => nav.navigate('LoginSecurity')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.nickname ?? '사용자'} 님</Text>
              <Text style={styles.profileEmail}>{user?.email ?? 'user@example.com'}</Text>
              <View style={styles.connRow}>
                <View style={styles.connDot} />
                <Text style={styles.connText}>CONNECTED</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 신체 정보 */}
        <View style={styles.section}>
          <Text style={styles.groupTitle}>신체 정보</Text>
          <View style={styles.card}>
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
          <Text style={styles.groupTitle}>알림</Text>
          <View style={styles.card}>
            <View style={styles.rowItem}>
              <View>
                <Text style={styles.rowLabel}>자세 알림</Text>
                <Text style={styles.rowSub}>거북목 감지 시 진동</Text>
              </View>
              <Toggle
                value={settings.postureAlertEnabled}
                onToggle={v => updateSettings({ postureAlertEnabled: v })}
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
                onToggle={v => updateSettings({ reportAlertEnabled: v })}
              />
            </View>
          </View>
        </View>

        {/* 데이터 */}
        <View style={styles.section}>
          <Text style={styles.groupTitle}>데이터</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.rowItem} onPress={() => setShowClearRecords(true)}>
              <View style={styles.dangerRow}>
                <Text style={styles.dangerIcon}>🗄️</Text>
                <View>
                  <Text style={styles.dangerLabel}>기록 초기화</Text>
                  <Text style={styles.rowSub}>모든 자세 기록 삭제</Text>
                </View>
              </View>
              <Text style={[styles.rowArrow, { color: COLORS.accent }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 로그아웃 */}
        <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.sm }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)}>
            <Text style={styles.logoutIcon}>⤷</Text>
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
        icon="⤷"
        title="로그아웃 하시겠습니까?"
        message="다시 로그인하여 사용하실 수 있습니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        confirmVariant="dark"
        onConfirm={() => { logout(); setShowLogout(false); }}
        onCancel={() => setShowLogout(false)}
      />
      <ConfirmModal
        visible={showClearRecords}
        icon="🗄️"
        title="기록을 초기화하시겠습니까?"
        message={'모든 자세 기록이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'}
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmVariant="danger"
        onConfirm={() => { clearRecords(); setShowClearRecords(false); }}
        onCancel={() => setShowClearRecords(false)}
      />
    </SafeAreaView>
  );
}

// ── 신체 정보 ──────────────────────────────────────
export function BodyInfoScreen() {
  const nav = useNavigation();
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
        <View style={bsStyles.overlay}>
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
              onPress={() => { updateUser({ height: Number(heightVal) }); setShowHeight(false); }}
            />
          </View>
        </View>
      </Modal>

      {/* 체중 바텀시트 */}
      <Modal visible={showWeight} transparent animationType="slide">
        <View style={bsStyles.overlay}>
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
              onPress={() => { updateUser({ weight: Number(weightVal) }); setShowWeight(false); }}
            />
          </View>
        </View>
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
              <Text style={styles.rowIcon}>✉️</Text>
              <View>
                <Text style={styles.rowSubLabel}>기본 이메일</Text>
                <Text style={styles.rowVal}>{user?.email ?? 'user@example.com'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.rowItem} onPress={() => nav.navigate('ChangePassword')}>
            <View style={styles.iconLabel}>
              <Text style={styles.rowIcon}>🔒</Text>
              <Text style={styles.rowLabel}>비밀번호 변경</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── 비밀번호 변경 ─────────────────────────────────────
export function ChangePasswordScreen() {
  const nav = useNavigation();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleChange = async () => {
    // Firebase updatePassword 자리
    nav.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <PageHeader title="비밀번호 변경" />
      <ScrollView contentContainerStyle={{ padding: SPACING.base }}>
        <View style={[styles.card, { marginBottom: SPACING.base }]}>
          <Text style={pwStyles.hint}>
            계정 보안을 위해 정기적으로 비밀번호를 변경하는 것을 권장합니다.
          </Text>
        </View>
        <View style={styles.card}>
          <View style={styles.rowItem}>
            <Text style={pwStyles.fieldLabel}>현재 비밀번호</Text>
          </View>
          <Input
            value={cur} onChangeText={setCur}
            placeholder="현재 비밀번호를 입력하세요"
            secureTextEntry
            style={{ marginBottom: SPACING.base }}
          />
          <Text style={pwStyles.fieldLabel}>새 비밀번호</Text>
          <Input
            value={next} onChangeText={setNext}
            placeholder="새 비밀번호를 입력하세요"
            secureTextEntry
            style={{ marginBottom: SPACING.sm }}
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
  hint: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  fieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
});

// ── 회원 탈퇴 ──────────────────────────────────────────
export function WithdrawScreen() {
  const nav = useNavigation();
  const { logout } = useStore();

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
            <Text style={wdStyles.warnIcon}>⚠️</Text>
            <Text style={wdStyles.warnTitle}>탈퇴 전에 확인해주세요</Text>
          </View>
          <Text style={wdStyles.warnDesc}>
            회원 탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
          </Text>
          {items.map((item, i) => (
            <View key={i} style={wdStyles.itemRow}>
              <View style={wdStyles.bullet} />
              <Text style={wdStyles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* 힌트 */}
        <View style={wdStyles.hintCard}>
          <Text style={wdStyles.hintText}>
            💡 잠깐만요!{'\n'}
            <Text style={wdStyles.hintLink}>일시적으로 사용을 중단하고 싶으시다면 로그아웃 후 다시 돌아오실 수 있습니다.</Text>
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <Button
          label="탈퇴 진행"
          onPress={() => { logout(); nav.replace('Login'); }}
          variant="danger"
          style={{ marginBottom: SPACING.sm }}
        />
        <Button label="취소" onPress={() => nav.goBack()} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}
const wdStyles = StyleSheet.create({
  warnCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, marginBottom: SPACING.base, ...SHADOWS.sm },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  warnIcon: { fontSize: 20 },
  warnTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  warnDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.base, lineHeight: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  bullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.accent },
  itemText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  hintCard: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: SPACING.base, marginBottom: SPACING.base },
  hintText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, lineHeight: 20 },
  hintLink: { color: COLORS.primary },
});

// ── 공통 스타일 ───────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  section: { paddingHorizontal: SPACING.base, marginBottom: SPACING.sm },
  groupTitle: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, ...SHADOWS.sm, overflow: 'hidden' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACING.base, ...SHADOWS.sm,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarIcon: { fontSize: 24, color: '#fff' },
  profileName: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  connText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  arrow: { fontSize: 20, color: COLORS.textMuted },

  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.base },
  rowLabel: { fontSize: FONTS.sizes.base, color: COLORS.text, fontWeight: '500' },
  rowSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rowVal: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.text },
  rowArrow: { fontSize: 18, color: COLORS.textMuted },
  rowIcon: { fontSize: 20, marginRight: SPACING.sm },
  iconLabel: { flexDirection: 'row', alignItems: 'center' },
  rowSubLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  separator: { height: 1, backgroundColor: COLORS.bgSecondary, marginHorizontal: SPACING.base },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dangerIcon: { fontSize: 20 },
  dangerLabel: { fontSize: FONTS.sizes.base, color: COLORS.accent, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgDark, borderRadius: RADIUS.full,
    height: 52,
  },
  logoutIcon: { fontSize: 18, color: '#fff' },
  logoutText: { fontSize: FONTS.sizes.base, fontWeight: '700', color: '#fff' },

  withdrawBtn: { alignSelf: 'center', marginTop: SPACING.base },
  withdrawText: { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: '600' },

  footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.base, marginBottom: SPACING.sm },
  footerLink: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  footerSep: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginHorizontal: SPACING.xs },
});
