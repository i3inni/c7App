export const COLORS = {
  // Primary
  primary: '#1DB38E',       // 민트/그린 - 메인 액션
  primaryLight: '#E8F8F3',
  primaryDark: '#15896C',

  // Accent
  accent: '#FF4B6E',        // 핑크레드 - 경고/위험
  accentLight: '#FFF0F3',
  kakao: '#FEE500',

  // Score colors
  scoreExcellent: '#1DB38E', // 우수 (90+)
  scoreGood: '#4CAF8A',      // 양호 (80+)
  scoreNormal: '#9B9BA0',    // 보통 (70+)
  scoreCaution: '#FF9500',   // 주의 (60+)
  scoreDanger: '#FF4B6E',    // 위험 (<60)

  // Gauge gradient
  gaugeGreen: '#1DB38E',
  gaugeYellow: '#FFD60A',
  gaugeRed: '#FF4B6E',

  // Neutrals
  bg: '#FFFFFF',
  bgSecondary: '#F5F6F8',
  bgCard: '#FFFFFF',
  bgDark: '#1A1E2E',
  bgDarkCard: '#252A3D',

  text: '#1A1E2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Status
  connected: '#1DB38E',
  disconnected: '#9CA3AF',
  warning: '#FF9500',
  danger: '#FF4B6E',
  info: '#3B82F6',

  // Step colors
  step1: '#1DB38E',
  step2: '#3B82F6',
  step3: '#8B5CF6',
};

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 36,
    '5xl': 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
