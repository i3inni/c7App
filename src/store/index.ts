import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User, DeviceState, PostureSnapshot, DayStats,
  WeekStats, AppNotification, AppSettings, PostureLevel, PostureType,
} from '../constants/types';
import { WeeklyReport, ExerciseStep, LLMDiagnosis, DiagnosisLevel } from '../services/aiService';

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
  currentAngles: { c7: number; t3: number; t7: number };
  currentLevel: PostureLevel;
  currentPostureType: PostureType;
  currentDiagnosisLevel: DiagnosisLevel | null; // ML 모델 직접 출력 (null이면 각도 기반 폴백)
  todayStats: DayStats | null;
  weeklyStats: WeekStats[];
  snapshots: PostureSnapshot[];

  // AI
  lastDiagnosis: LLMDiagnosis | null;
  lastExercises: [ExerciseStep, ExerciseStep, ExerciseStep] | null;
  lastExercisesAt: number | null;
  lastDiagnosisAt: number | null;
  lastWeeklyReport: WeeklyReport | null;

  setLastDiagnosis: (d: LLMDiagnosis) => void;

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

  updatePosture: (score: number, angle: number, postureType?: PostureType) => void;
  setAngles: (angles: { c7: number; t3: number; t7: number }) => void;
  setPostureType: (type: PostureType) => void;
  setDiagnosisLevel: (level: DiagnosisLevel | null) => void;
  setTodayStats: (stats: DayStats) => void;
  setWeeklyStats: (stats: WeekStats[]) => void;
  addSnapshot: (snapshot: PostureSnapshot) => void;

  setLastExercises: (e: [ExerciseStep, ExerciseStep, ExerciseStep]) => void;
  setLastWeeklyReport: (r: WeeklyReport) => void;

  addNotification: (n: AppNotification) => void;
  setNotifications: (ns: AppNotification[]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  clearRecords: () => void;
}


// ── Store (persist로 앱 재시작 후에도 데이터 유지) ──────
export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,

      device: {
        deviceId: null,
        bleDeviceId: null,
        mqttStatus: 'idle',
        battery: 75,
        powerOn: true,
        vibrationEnabled: true,
        vibrationIntensity: 66,
        sensorAngle: 30,
        powerSaveMode: false,
        connectedSsid: null,
      },

      currentScore: 60,
      currentAngle: 18.5,
      currentAngles: { c7: 18.5, t3: 12.0, t7: 7.5 },
      currentLevel: 'good',
      currentPostureType: 'forward_head',
      currentDiagnosisLevel: null,
      todayStats: null,
      weeklyStats: [],
      snapshots: [],

      notifications: [],

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
      updatePosture: (score, angle, postureType) =>
        set({ currentScore: score, currentAngle: angle, currentLevel: scoreToLevel(score), ...(postureType ? { currentPostureType: postureType } : {}) }),
      setAngles: (angles) => set({ currentAngles: angles }),
      setPostureType: (type) => set({ currentPostureType: type }),
      setDiagnosisLevel: (level) => set({ currentDiagnosisLevel: level }),
      setTodayStats: (stats) => set({ todayStats: stats }),
      setWeeklyStats: (stats) => set({ weeklyStats: stats }),
      addSnapshot: (snapshot) =>
        set((s) => ({ snapshots: [snapshot, ...s.snapshots].slice(0, 500) })),

      lastDiagnosis: null,
      setLastDiagnosis: (d) => set({ lastDiagnosis: d, lastDiagnosisAt: Date.now() }),
      lastExercises: null,
      lastExercisesAt: null,
      lastDiagnosisAt: null,
      setLastExercises: (e) => set({ lastExercises: e, lastExercisesAt: Date.now() }),
      lastWeeklyReport: null,
      setLastWeeklyReport: (r: WeeklyReport) => set({ lastWeeklyReport: r }),

      addNotification: (n) =>
        set((s) => ({ notifications: [n, ...s.notifications] })),
      setNotifications: (ns) => set({ notifications: ns }),
      removeNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      clearNotifications: () => set({ notifications: [] }),

      // Settings
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      // Data
      clearRecords: () =>
        set({ snapshots: [], todayStats: null, weeklyStats: [] }),
    }),
    {
      name: 'c7-app-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        device: state.device,
        todayStats: state.todayStats,
        weeklyStats: state.weeklyStats,
        snapshots: state.snapshots,
        notifications: state.notifications,
        settings: state.settings,
        lastDiagnosis: state.lastDiagnosis,
        lastExercises: state.lastExercises,
        lastExercisesAt: state.lastExercisesAt,
        lastDiagnosisAt: state.lastDiagnosisAt,
        lastWeeklyReport: state.lastWeeklyReport,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 앱 재시작 시 MQTT 연결 상태는 초기화 (기기 설정값은 유지)
          state.device = { ...state.device, mqttStatus: 'idle' };
        }
      },
    }
  )
);
