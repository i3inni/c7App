import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../store";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { COLORS, FONTS, SPACING } from "../../constants/theme";
import { login, loginWithGoogle } from "../../services/authService";

export default function LoginScreen() {
  const nav = useNavigation();
  const setUser = useStore((s) => s.setUser);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // 이메일/비밀번호 로그인
  const handleLogin = async () => {
    if (!id || !pw) return;
    setLoading(true);
    try {
      const user = await login(id, pw);
      setUser({ id: user.uid, nickname: user.email ?? id, isGuest: false });
      (nav as any).replace("MqttConnect");
    } catch (e: any) {
      Alert.alert("로그인 실패", firebaseErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  // 구글 로그인
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      setUser({
        id: user.uid,
        nickname: user.displayName ?? "사용자",
        email: user.email ?? undefined,
        isGuest: false,
      });
      (nav as any).replace("MqttConnect");
    } catch (e: any) {
      if (e.message !== "Google 로그인 취소됨") {
        Alert.alert("구글 로그인 실패", e.message);
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
    </SafeAreaView>
  );
}

// Firebase 에러 코드 → 한국어 메시지 변환
const firebaseErrorMessage = (code: string): string => {
  switch (code) {
    case "auth/user-not-found":     return "존재하지 않는 계정입니다.";
    case "auth/wrong-password":     return "비밀번호가 틀렸습니다.";
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
