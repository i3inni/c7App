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

// 모델이 감지하는 자세 타입 (나중에 ML 모델 출력과 매핑)
export type PostureType =
  | 'normal'        // 정상
  | 'forward_head'  // 거북목
  | 'rounded_back'  // 굽은 등
  | 'straight_neck' // 일자목
  | 'tilted'        // 기울어진 자세
  | 'unknown';      // 미감지

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
  dailyScore: number;
  badPostureCount: number;
  correctionCount: number;
  avgAngle: number;
  vibrationCount: number;
  totalUsageTime: number; // 시간 단위 (e.g. 6.2)
}

export interface WeekStats {
  weekLabel: string; // '1주' (표시용)
  avgScore: number;
  scoreChange?: number; // 전주 대비 변화
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
