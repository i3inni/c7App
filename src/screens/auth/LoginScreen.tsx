import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../store";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants/theme";

export default function LoginScreen() {
  const nav = useNavigation<any>();
  const setUser = useStore((s) => s.setUser);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!id || !pw) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800)); // Firebase auth 자리
    setUser({ id, nickname: id, isGuest: false });
    nav.replace("MqttConnect");
    setLoading(false);
  };

  const handleGuest = () => {
    setUser({ id: "guest", nickname: "비회원", isGuest: true });
    nav.replace("MqttConnect");
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
          <Input value={id} onChangeText={setId} placeholder="아이디" />
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
            onPress={() => nav.navigate("SignUpStep1")}
            style={styles.signupBtn}
          >
            <Text style={styles.signupText}>회원가입하겠습니다.</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.line} />
        </View>

        {/* Kakao */}
        <Button
          label="💬  카카오 로그인"
          onPress={() => {}} // 카카오 SDK 연동 자리
          variant="kakao"
          style={styles.kakaoBtn}
        />

        {/* Guest */}
        <TouchableOpacity onPress={handleGuest} style={styles.guestBtn}>
          <Text style={styles.guestText}>비회원으로 시작하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

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

  kakaoBtn: {},
  guestBtn: {
    alignSelf: "center",
    marginTop: SPACING.base,
    paddingVertical: SPACING.sm,
  },
  guestText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
});
