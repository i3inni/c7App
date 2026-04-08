import { create } from 'zustand';
import {
  User, DeviceState, PostureSnapshot, DayStats,
  WeekStats, AppNotification, AppSettings, PostureLevel,
} from '../constants/types';

// ── 유틸 ────────────────────────────────────────────
function scoreToLevel(score: number): PostureLevel {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'normal';
  if (score >= 60) return 'caution';
  return 'danger';
}

// ── State 타입 ──────────────────────────────────────
interface AppState {
  // Auth
  user: User | null;
  isLoggedIn: boolean;

  // Device
  device: DeviceState;

  // Posture
  currentScore: number;
  currentAngle: number;
  currentLevel: PostureLevel;
  todayStats: DayStats | null;
  weeklyStats: WeekStats[];
  snapshots: PostureSnapshot[];

  // Notifications
  notifications: AppNotification[];

  // Settings
  settings: AppSettings;

  // ── Actions ──
  setUser: (user: User | null) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;

  setDevice: (partial: Partial<DeviceState>) => void;
  connectMqtt: (deviceId: string) => void;
  disconnectMqtt: () => void;

  updatePosture: (score: number, angle: number) => void;
  setTodayStats: (stats: DayStats) => void;
  setWeeklyStats: (stats: WeekStats[]) => void;

  addNotification: (n: AppNotification) => void;
  clearNotifications: () => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  clearRecords: () => void;
}

// ── Mock 초기 데이터 ────────────────────────────────
const MOCK_WEEKLY: WeekStats[] = [
  { weekLabel: '1주', score: 73 },
  { weekLabel: '2주', score: 71 },
  { weekLabel: '3주', score: 78 },
  { weekLabel: '4주', score: 85 },
  { weekLabel: '5주', score: 88 },
];

const MOCK_TODAY: DayStats = {
  date: new Date().toISOString().split('T')[0],
  score: 82,
  badPostureCount: 4,
  correctionMin: 45,
  avgAngle: 17.2,
  vibrationCount: 8,
  goodPostureHours: 6.2,
};

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: '1',
    category: 'posture',
    title: '자세 위험 알림',
    body: '거북목 각도가 25도를 넘었습니다. 어깨를 펴주세요!',
    timeAgo: '방금 전',
    read: false,
  },
  {
    id: '2',
    category: 'report',
    title: '주간 리포트 발행',
    body: '지난주보다 바른 자세 유지 시간이 15% 증가했습니다.',
    timeAgo: '2시간 전',
    read: false,
  },
  {
    id: '3',
    category: 'device',
    title: '기기 연결 완료',
    body: 'C7 교정 기기가 정상적으로 연결되었습니다.',
    timeAgo: '5시간 전',
    read: false,
  },
];

// ── Store ───────────────────────────────────────────
export const useStore = create<AppState>((set, get) => ({
  user: null,
  isLoggedIn: false,

  device: {
    deviceId: null,
    mqttStatus: 'idle',
    battery: 75,
    powerOn: true,
    vibrationEnabled: true,
    vibrationIntensity: 66,
    sensorAngle: 30,
    powerSaveMode: false,
  },

  currentScore: 84,
  currentAngle: 18.5,
  currentLevel: 'good',
  todayStats: MOCK_TODAY,
  weeklyStats: MOCK_WEEKLY,
  snapshots: [],

  notifications: MOCK_NOTIFICATIONS,

  settings: {
    postureAlertEnabled: true,
    reportAlertEnabled: true,
    targetScore: 85,
  },

  // Auth
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  logout: () => set({ user: null, isLoggedIn: false }),
  updateUser: (partial) =>
    set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),

  // Device
  setDevice: (partial) =>
    set((s) => ({ device: { ...s.device, ...partial } })),
  connectMqtt: (deviceId) =>
    set((s) => ({
      device: { ...s.device, deviceId, mqttStatus: 'connecting' },
    })),
  disconnectMqtt: () =>
    set((s) => ({
      device: { ...s.device, deviceId: null, mqttStatus: 'disconnected' },
    })),

  // Posture
  updatePosture: (score, angle) =>
    set({ currentScore: score, currentAngle: angle, currentLevel: scoreToLevel(score) }),
  setTodayStats: (stats) => set({ todayStats: stats }),
  setWeeklyStats: (stats) => set({ weeklyStats: stats }),

  // Notifications
  addNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications] })),
  clearNotifications: () => set({ notifications: [] }),

  // Settings
  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  // Data
  clearRecords: () =>
    set({ snapshots: [], todayStats: null, weeklyStats: [] }),
}));
