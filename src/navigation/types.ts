import { NavigatorScreenParams } from '@react-navigation/native';

// ── BottomTab 파라미터 ────────────────────────────────
export type MainTabParamList = {
  HOME: undefined;
  STATS: undefined;
  AI: undefined;
  CONFIG: undefined;
};

// ── Stack 파라미터 ────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignUpStep1: undefined;
  SignUpStep2: { userId: string };
  SignUpStep3: { userId: string; password: string };
  SignUpComplete: { userId: string; password: string; nickname: string };
  MqttConnect: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  MyInfo: undefined;
  BodyInfo: undefined;
  LoginSecurity: undefined;
  ChangePassword: undefined;
  Withdraw: undefined;
};

// 전역 선언: useNavigation() 자동 타입 추론
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
