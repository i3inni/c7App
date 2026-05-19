import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../store";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ConfirmModal from "../../components/common/ConfirmModal";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants/theme";
import { login, logout, loginWithGoogle, reactivateAccount, resendVerificationEmail } from "../../services/authService";
import { getUserDoc } from "../../services/userService";
import { ADMIN_EMAILS } from "../../constants/adminConfig";

interface PendingUser {
  uid: string;
  nickname: string;
  email: string | undefined;
  height: number | undefined;
  weight: number | undefined;
}

export default function LoginScreen() {
  const nav = useNavigation();
  const setUser = useStore((s) => s.setUser);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  const proceedLogin = (u: PendingUser) => {
    setUser({
      id: u.uid,
      nickname: u.nickname,
      email: u.email,
      isGuest: false,
      height: u.height,
      weight: u.weight,
    });
    (nav as any).replace("MqttConnect");
  };

  const handleReactivateConfirm = async () => {
    if (!pendingUser) return;
    setShowReactivateModal(false);
    await reactivateAccount(pendingUser.uid);
    proceedLogin(pendingUser);
  };

  const handleReactivateCancel = async () => {
    setShowReactivateModal(false);
    setPendingUser(null);
    await logout();
  };

  const checkAndLogin = async (
    uid: string,
    doc: any,
    fallbackNickname: string,
    fallbackEmail: string | undefined,
  ) => {
    const userData: PendingUser = {
      uid,
      nickname: doc?.account?.nickname ?? fallbackNickname,
      email: doc?.account?.email ?? fallbackEmail,
      height: doc?.bodyInfo?.height ?? undefined,
      weight: doc?.bodyInfo?.weight ?? undefined,
    };

    if (doc?.account?.isActive === false) {
      if (doc?.account?.withdrawnAt) {
        setPendingUser(userData);
        setShowReactivateModal(true);
      } else {
        // 신규 가입 후 첫 로그인 — 자동 활성화
        await reactivateAccount(uid);
        proceedLogin(userData);
      }
      return;
    }
    proceedLogin(userData);
  };

  // 이메일/비밀번호 로그인
  const handleLogin = async () => {
    if (!id || !pw) return;
    setLoading(true);
    try {
      const user = await login(id, pw);
      if (!user.emailVerified && !ADMIN_EMAILS.includes(user.email ?? '')) {
        Alert.alert(
          '이메일 인증 필요',
          '가입 시 발송된 인증 메일을 확인해주세요.',
          [
            {
              text: '인증 메일 재발송',
              onPress: async () => {
                try {
                  await resendVerificationEmail();
                  Alert.alert('발송 완료', '인증 메일을 재발송했습니다.');
                } catch {
                  Alert.alert('오류', '메일 발송에 실패했습니다.');
                }
              },
            },
            { text: '확인', style: 'cancel' },
          ],
        );
        return;
      }
      const doc = await getUserDoc(user.uid);
      await checkAndLogin(user.uid, doc, user.email ?? id, user.email ?? undefined);
    } catch (e: any) {
      console.error('[Login Error]', e.code, e.message);
      setErrorModal({ title: '로그인 실패', message: firebaseErrorMessage(e.code) + (e.code ? `\n(${e.code})` : '') });
    } finally {
      setLoading(false);
    }
  };

  // 구글 로그인
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      const doc = await getUserDoc(user.uid);
      await checkAndLogin(user.uid, doc, user.displayName ?? '사용자', user.email ?? undefined);
    } catch (e: any) {
      if (e.message !== "Google 로그인 취소됨") {
        setErrorModal({ title: '구글 로그인 실패', message: e.message });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // 비회원
  const handleGuest = () => {
    setUser({ id: "guest", nickname: "비회원", isGuest: true });
    (nav as any).replace("MqttConnect");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚡</Text>
          </View>
          <Text style={styles.appName}>C7 AI</Text>
          <Text style={styles.tagline}>Smart Posture Intelligence</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input value={id} onChangeText={setId} placeholder="이메일" keyboardType="email-address" />
          <Input
            value={pw}
            onChangeText={setPw}
            placeholder="비밀번호"
            secureTextEntry
            style={styles.inputGap}
          />
          <Button
            label="로그인"
            onPress={handleLogin}
            disabled={!id || !pw}
            loading={loading}
            style={styles.loginBtn}
          />
          <TouchableOpacity
            onPress={() => (nav as any).navigate("SignUpStep1")}
            style={styles.signupBtn}
          >
            <Text style={styles.signupText}>회원가입</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.line} />
        </View>

        {/* 구글 로그인 */}
        <Button
          label="🔵  Google로 로그인"
          onPress={handleGoogleLogin}
          loading={googleLoading}
          variant="secondary"
          style={styles.googleBtn}
        />

        {/* Guest */}
        <TouchableOpacity onPress={handleGuest} style={styles.guestBtn}>
          <Text style={styles.guestText}>비회원으로 시작하기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 로그인 오류 모달 */}
      <ConfirmModal
        visible={!!errorModal}
        iconNode={
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="9" stroke={COLORS.accent} strokeWidth="1.8" />
            <Path d="M12 8v4" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" />
            <Circle cx="12" cy="16" r="1" fill={COLORS.accent} />
          </Svg>
        }
        iconBg={COLORS.accentLight}
        title={errorModal?.title ?? '오류'}
        message={errorModal?.message ?? ''}
        confirmLabel="확인"
        confirmVariant="danger"
        hideCancel
        onConfirm={() => setErrorModal(null)}
      />

      {/* 탈퇴 취소 모달 */}
      <ConfirmModal
        visible={showReactivateModal}
        iconNode={
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="8" r="4" stroke={COLORS.primary} strokeWidth="1.8" />
            <Path
              d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
              stroke={COLORS.primary} strokeWidth="1.8" strokeLinecap="round"
            />
            <Path
              d="M17 14l1.5 1.5L21 13"
              stroke={COLORS.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
        }
        iconBg={COLORS.primaryLight}
        title="다시 돌아오셨군요!"
        message={`탈퇴 처리된 계정입니다.\n탈퇴를 취소하고 다시 시작하시겠습니까?`}
        confirmLabel="탈퇴 취소"
        cancelLabel="아니요"
        confirmVariant="primary"
        onConfirm={handleReactivateConfirm}
        onCancel={handleReactivateCancel}
      />
    </SafeAreaView>
  );
}

// Firebase 에러 코드 → 한국어 메시지 변환
const firebaseErrorMessage = (code: string): string => {
  switch (code) {
    case "auth/user-not-found":     return "존재하지 않는 계정입니다.";
    case "auth/wrong-password":     return "비밀번호가 틀렸습니다.";
    case "auth/invalid-credential": return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/invalid-email":      return "이메일 형식이 올바르지 않습니다.";
    case "auth/too-many-requests":  return "잠시 후 다시 시도해주세요.";
    case "auth/network-request-failed": return "네트워크 연결을 확인해주세요.";
    default:                        return "로그인 중 오류가 발생했습니다.";
  }
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: "center",
  },
  logoArea: { alignItems: "center", marginBottom: SPACING["3xl"] },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFE8ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconText: { fontSize: 32 },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    fontStyle: "italic",
  },
  tagline: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  form: { gap: 0 },
  inputGap: { marginTop: SPACING.sm },
  loginBtn: { marginTop: SPACING.base },
  signupBtn: { alignSelf: "center", marginTop: SPACING.base },
  signupText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    marginHorizontal: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },

  googleBtn: {},
  guestBtn: {
    alignSelf: "center",
    marginTop: SPACING.base,
    paddingVertical: SPACING.sm,
  },
  guestText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

});
