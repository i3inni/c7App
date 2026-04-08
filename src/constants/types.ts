// ─── Auth ─────────────────────────────────────────
export interface User {
  id: string;
  nickname: string;
  email?: string;
  height?: number;
  weight?: number;
  isGuest: boolean;
}

// ─── Device / MQTT ────────────────────────────────
export type MqttStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface DeviceState {
  deviceId: string | null;
  mqttStatus: MqttStatus;
  battery: number;           // 0-100
  powerOn: boolean;
  vibrationEnabled: boolean;
  vibrationIntensity: number; // 0-100
  sensorAngle: number;        // calibration angle
  powerSaveMode: boolean;
}

// ─── Posture / Sensor ─────────────────────────────
export type PostureLevel = 'excellent' | 'good' | 'normal' | 'caution' | 'danger';

export interface PostureSnapshot {
  id: string;
  timestamp: number;
  score: number;
  angle: number;
  level: PostureLevel;
  durationMin: number;
}

export interface DayStats {
  date: string; // YYYY-MM-DD
  score: number;
  badPostureCount: number;
  correctionMin: number;
  avgAngle: number;
  vibrationCount: number;
  goodPostureHours: number;
}

export interface WeekStats {
  weekLabel: string; // '1주'
  score: number;
}

// ─── Notifications ────────────────────────────────
export type NotificationCategory = 'posture' | 'report' | 'device';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  timeAgo: string;
  read: boolean;
}

// ─── Settings ─────────────────────────────────────
export interface AppSettings {
  postureAlertEnabled: boolean;
  reportAlertEnabled: boolean;
  targetScore: number;
}
