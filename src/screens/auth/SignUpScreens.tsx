import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { checkEmailDuplicate, signUp } from '../../services/authService';

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
          <Text style={styles.backText}>‹ 뒤로</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stepLabel}>
        <Text style={styles.signUpTitle}>SIGN UP</Text>
        <Text style={styles.stepSub}>
          STEP {step} / {total}:{" "}
          {step === 1 ? "이메일 설정" : step === 2 ? "비밀번호 설정" : "닉네임 설정"}
        </Text>
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

// ── Step 1: 이메일 ──────────────────────────────────
export function SignUpStep1() {
  const nav = useNavigation();
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleCheck = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('이메일 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      // Firestore에서 이미 사용 중인 이메일인지 확인
      const isDuplicate = await checkEmailDuplicate(email);
      setAvailable(!isDuplicate);
      setChecked(true);
      if (isDuplicate) Alert.alert('중복 확인', '이미 사용 중인 이메일입니다.');
    } catch (e) {
      Alert.alert('오류', '중복 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignUpLayout step={1} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerContent}>
        <View style={styles.centerIcon}>
          <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
            <Text style={styles.icon}>✉️</Text>
          </View>
        </View>
        <Text style={styles.stageTitle}>이메일을 입력해주세요</Text>
        <Text style={styles.stageSub}>로그인에 사용할 이메일 주소</Text>

        <View style={{ marginTop: SPACING.xl }}>
          <Input
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setChecked(false);
              setAvailable(null);
            }}
            placeholder="example@email.com"
            keyboardType="email-address"
            rightElement={
              available === true ? (
                <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text>
              ) : undefined
            }
          />
          <TouchableOpacity
            style={[styles.checkBtn, isValidEmail(email) && styles.checkBtnActive]}
            onPress={handleCheck}
            disabled={!isValidEmail(email) || loading}
          >
            <Text style={[styles.checkBtnText, isValidEmail(email) && styles.checkBtnTextActive]}>
              {loading ? '확인 중...' : '중복 확인'}
            </Text>
          </TouchableOpacity>
          {available === true && (
            <Text style={styles.availableText}>사용 가능한 이메일입니다</Text>
          )}
        </View>
      </View>

      <Button
        label="다음 단계  →"
        onPress={() => (nav as any).navigate("SignUpStep2", { userId: email })}
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

  const strength: null | "weak" | "normal" | "strong" =
    pw.length === 0 ? null : pw.length < 4 ? "weak" : pw.length < 8 ? "normal" : "strong";

  const strengthColor =
    strength === "weak" ? COLORS.accent : strength === "normal" ? COLORS.warning : COLORS.primary;
  const strengthLabel =
    strength === "weak" ? "약함" : strength === "normal" ? "보통" : "강함";
  const strengthRatio =
    strength === "weak" ? 0.25 : strength === "normal" ? 0.6 : 1;

  return (
    <SignUpLayout step={2} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerContent}>
        <View style={styles.centerIcon}>
          <View style={[styles.iconCircle, { backgroundColor: "#E8F8F3" }]}>
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
      </View>

      <Button
        label="다음 단계  →"
        onPress={() => (nav as any).navigate("SignUpStep3", { ...route.params, password: pw })}
        disabled={!strength || strength === "weak"}
        style={styles.nextBtn}
      />
    </SignUpLayout>
  );
}

// ── Step 3: 닉네임 ──────────────────────────────────
export function SignUpStep3({ route }: { route: RouteProp<RootStackParamList, 'SignUpStep3'> }) {
  const nav = useNavigation();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { userId: email, password } = route.params;

      // Firebase Auth 계정 생성 + Firestore에 유저 프로필 저장
      await signUp(email, password, nickname);

      (nav as any).navigate("SignUpComplete", { ...route.params, nickname });
    } catch (e: any) {
      Alert.alert('회원가입 실패', firebaseErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignUpLayout step={3} total={3} onBack={() => nav.goBack()}>
      <View style={styles.centerContent}>
        <View style={styles.centerIcon}>
          <View style={[styles.iconCircle, { backgroundColor: "#F3EEFF" }]}>
            <Text style={styles.icon}>✨</Text>
          </View>
        </View>
        <Text style={styles.stageTitle}>닉네임을 입력해주세요</Text>
        <Text style={styles.stageSub}>다른 사용자에게 보여질 이름</Text>

        <View style={{ marginTop: SPACING.xl }}>
          <Input value={nickname} onChangeText={setNickname} placeholder="닉네임 입력" />
        </View>
      </View>

      <Button
        label="가입 완료  →"
        onPress={handleComplete}
        loading={loading}
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
        <TouchableOpacity onPress={() => (nav as any).navigate("Login")} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stepLabel}>
        <Text style={[styles.signUpTitle, { fontStyle: "italic" }]}>WELCOME!</Text>
        <Text style={styles.stepSub}>REGISTRATION COMPLETE</Text>
      </View>
      <View style={styles.content}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={[styles.iconCircle, { backgroundColor: "#E8F8F3", width: 72, height: 72, borderRadius: 36, marginBottom: 20 }]}>
            <Text style={{ fontSize: 32 }}>✅</Text>
          </View>
          <Text style={styles.stageTitle}>회원가입 완료!</Text>
          <Text style={styles.stageSub}>
            환영합니다, {nickname}님{"\n"}이제 로그인하여 C7 기기를 연결해보세요
          </Text>

          <View style={[styles.summaryBox, { width: '100%' }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>이메일</Text>
              <Text style={styles.summaryVal}>{userId}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>닉네임</Text>
              <Text style={styles.summaryVal}>{nickname}</Text>
            </View>
          </View>

          <Button
            label="로그인하러 가기"
            onPress={() => (nav as any).replace("Login")}
            style={{ marginTop: SPACING.xl, width: "100%" }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// Firebase 에러 코드 → 한국어 메시지
const firebaseErrorMessage = (code: string): string => {
  switch (code) {
    case "auth/email-already-in-use":   return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":           return "이메일 형식이 올바르지 않습니다.";
    case "auth/weak-password":           return "비밀번호가 너무 약합니다.";
    case "auth/network-request-failed":  return "네트워크 연결을 확인해주세요.";
    default:                             return "회원가입 중 오류가 발생했습니다.";
  }
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6F8" },
  topNav: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
  backBtn: { paddingVertical: SPACING.xs },
  backText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  stepLabel: { paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  signUpTitle: { fontSize: FONTS.sizes["2xl"], fontWeight: "800", color: COLORS.text },
  stepSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: SPACING.xl },
  centerContent: { flex: 1, justifyContent: 'center' },
  centerIcon: { alignItems: "center", marginBottom: SPACING.lg },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 28 },
  stageTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  stageSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 20 },
  nextBtn: { marginTop: 'auto' as const, marginBottom: SPACING.base },
  checkBtn: {
    marginTop: SPACING.sm, height: 44, borderRadius: RADIUS.full,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 0.1, borderColor: COLORS.border,
  },
  checkBtnActive: { backgroundColor: "#E8F8F3", borderColor: COLORS.primary },
  checkBtnText: { fontSize: FONTS.sizes.md, color: COLORS.textMuted, fontWeight: "600" },
  checkBtnTextActive: { color: COLORS.primary },
  availableText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, marginTop: SPACING.xs, paddingLeft: SPACING.xs },
  strengthTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FONTS.sizes.sm, fontWeight: "600", textAlign: "right", marginTop: 4 },
  summaryBox: { width: "100%", marginTop: SPACING.xl, backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.base },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACING.sm },
  summaryKey: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  summaryVal: { fontSize: FONTS.sizes.md, fontWeight: "700", color: COLORS.text },
});
