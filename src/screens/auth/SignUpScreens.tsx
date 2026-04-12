import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

// ── 공용 레이아웃 ───────────────────────────────────
function SignUpLayout({
  step, total, children, onBack,
}: {
  step: number; total: number; children: React.ReactNode; onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹  뒤로</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stepLabel}>
        <Text style={styles.signUpTitle}>SIGN UP</Text>
        <Text style={styles.stepSub}>STEP {step} / {total}: {
          step === 1 ? '아이디 설정' : step === 2 ? '비밀번호 설정' : '닉네임 설정'
        }</Text>
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

// ── Step 1: 아이디 ──────────────────────────────────
export function SignUpStep1() {
  const nav = useNavigation();
  const [id, setId] = useState('');
  const [checked, setChecked] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const handleCheck = async () => {
    // Firebase 중복확인 자리
    await new Promise(r => setTimeout(r, 400));
    setAvailable(true);
    setChecked(true);
  };

  return (
    <SignUpLayout step={1} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerIcon}>
        <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
          <Text style={styles.icon}>👤</Text>
        </View>
      </View>
      <Text style={styles.stageTitle}>아이디를 입력해주세요</Text>
      <Text style={styles.stageSub}>4자 이상의 영문/숫자 조합</Text>

      <View style={{ marginTop: SPACING.xl }}>
        <Input
          value={id}
          onChangeText={t => { setId(t); setChecked(false); setAvailable(null); }}
          placeholder="아이디 입력"
          rightElement={available === true ? <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text> : undefined}
        />
        <TouchableOpacity
          style={[styles.checkBtn, id.length >= 4 && styles.checkBtnActive]}
          onPress={handleCheck}
          disabled={id.length < 4}
        >
          <Text style={[styles.checkBtnText, id.length >= 4 && styles.checkBtnTextActive]}>중복 확인</Text>
        </TouchableOpacity>
        {available === true && (
          <Text style={styles.availableText}>사용 가능한 아이디입니다</Text>
        )}
      </View>

      <Button
        label="다음 단계  →"
        onPress={() => nav.navigate('SignUpStep2', { userId: id })}
        disabled={!checked || !available}
        style={styles.nextBtn}
      />
    </SignUpLayout>
  );
}

// ── Step 2: 비밀번호 ────────────────────────────────
export function SignUpStep2({ route }: { route: RouteProp<RootStackParamList, 'SignUpStep2'> }) {
  const nav = useNavigation();
  const [pw, setPw] = useState('');

  const strength: null | 'weak' | 'normal' | 'strong' =
    pw.length === 0 ? null :
    pw.length < 4 ? 'weak' :
    pw.length < 8 ? 'normal' : 'strong';

  const strengthColor =
    strength === 'weak' ? COLORS.accent :
    strength === 'normal' ? COLORS.warning : COLORS.primary;

  const strengthLabel =
    strength === 'weak' ? '약함' :
    strength === 'normal' ? '보통' : '강함';

  const strengthRatio =
    strength === 'weak' ? 0.25 :
    strength === 'normal' ? 0.6 : 1;

  return (
    <SignUpLayout step={2} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerIcon}>
        <View style={[styles.iconCircle, { backgroundColor: '#E8F8F3' }]}>
          <Text style={styles.icon}>🔒</Text>
        </View>
      </View>
      <Text style={styles.stageTitle}>비밀번호를 설정해주세요</Text>
      <Text style={styles.stageSub}>6자 이상의 안전한 비밀번호</Text>

      <View style={{ marginTop: SPACING.xl }}>
        <Input value={pw} onChangeText={setPw} placeholder="비밀번호 입력" secureTextEntry />
        {strength && (
          <View style={{ marginTop: SPACING.sm }}>
            <View style={styles.strengthTrack}>
              <View style={[styles.strengthFill, { width: `${strengthRatio * 100}%`, backgroundColor: strengthColor }]} />
            </View>
            <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
          </View>
        )}
      </View>

      <Button
        label="다음 단계  →"
        onPress={() => nav.navigate('SignUpStep3', { ...route.params, password: pw })}
        disabled={!strength || strength === 'weak'}
        style={styles.nextBtn}
      />
    </SignUpLayout>
  );
}

// ── Step 3: 닉네임 ──────────────────────────────────
export function SignUpStep3({ route }: { route: RouteProp<RootStackParamList, 'SignUpStep3'> }) {
  const nav = useNavigation();
  const [nickname, setNickname] = useState('');

  const handleComplete = async () => {
    // Firebase createUser 자리
    await new Promise(r => setTimeout(r, 500));
    nav.navigate('SignUpComplete', { ...route.params, nickname });
  };

  return (
    <SignUpLayout step={3} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerIcon}>
        <View style={[styles.iconCircle, { backgroundColor: '#F3EEFF' }]}>
          <Text style={styles.icon}>✨</Text>
        </View>
      </View>
      <Text style={styles.stageTitle}>닉네임을 입력해주세요</Text>
      <Text style={styles.stageSub}>다른 사용자에게 보여질 이름</Text>

      <View style={{ marginTop: SPACING.xl }}>
        <Input value={nickname} onChangeText={setNickname} placeholder="닉네임 입력" />
      </View>

      <Button
        label="다음 단계  →"
        onPress={handleComplete}
        disabled={nickname.trim().length < 1}
        style={styles.nextBtn}
      />
    </SignUpLayout>
  );
}

// ── 완료 화면 ────────────────────────────────────────
export function SignUpComplete({ route }: { route: RouteProp<RootStackParamList, 'SignUpComplete'> }) {
  const nav = useNavigation();
  const { userId, nickname } = route.params ?? {};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => nav.navigate('Login')} style={styles.backBtn}>
          <Text style={styles.backText}>‹  뒤로</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stepLabel}>
        <Text style={[styles.signUpTitle, { fontStyle: 'italic' }]}>WELCOME!</Text>
        <Text style={styles.stepSub}>REGISTRATION COMPLETE</Text>
      </View>
      <View style={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.iconCircle, { backgroundColor: '#E8F8F3', width: 72, height: 72, borderRadius: 36, marginBottom: 20 }]}>
          <Text style={{ fontSize: 32 }}>✅</Text>
        </View>
        <Text style={styles.stageTitle}>회원가입 완료!</Text>
        <Text style={styles.stageSub}>환영합니다, {nickname}님{'\n'}이제 로그인하여 C7 기기를 연결해보세요</Text>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>아이디</Text>
            <Text style={styles.summaryVal}>{userId}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>닉네임</Text>
            <Text style={styles.summaryVal}>{nickname}</Text>
          </View>
        </View>

        <Button label="로그인하러 가기" onPress={() => nav.replace('Login')} style={{ marginTop: SPACING.xl, width: '100%' }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  topNav: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
  backBtn: { paddingVertical: SPACING.xs },
  backText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  stepLabel: { paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  signUpTitle: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.text },
  stepSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING['3xl'] },
  centerIcon: { alignItems: 'center', marginBottom: SPACING.lg },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  stageTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  stageSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 20 },
  nextBtn: { marginTop: 'auto' as const, marginBottom: SPACING.base },
  checkBtn: {
    marginTop: SPACING.sm, height: 44, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSecondary, alignItems: 'center', justifyContent: 'center',
  },
  checkBtnActive: { backgroundColor: '#E8F8F3' },
  checkBtnText: { fontSize: FONTS.sizes.md, color: COLORS.textMuted, fontWeight: '600' },
  checkBtnTextActive: { color: COLORS.primary },
  availableText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, marginTop: SPACING.xs, paddingLeft: SPACING.xs },
  strengthTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden' },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', textAlign: 'right', marginTop: 4 },
  summaryBox: {
    width: '100%', marginTop: SPACING.xl,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.base,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  summaryKey: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  summaryVal: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
});
