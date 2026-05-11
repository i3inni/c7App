/**
 * HiveMQ WebSocket MQTT 클라이언트
 *
 * 흐름: posture_server(Railway) → posture/{deviceId}/result publish
 *       → 앱 구독 → Zustand store 업데이트 (score, angle, postureType, diagnosisLevel)
 *
 * 연결 방식: WSS (port 8884) — React Native에서 TCP 직접 연결 불가능하므로 WebSocket 사용
 */

import mqtt, { MqttClient } from 'mqtt';
import { useStore } from '../store';
import { DiagnosisLevel } from './aiService';
import { PostureType } from '../constants/types';

const MQTT_URL  = 'wss://53ceba2180d1435eb327eff55f0bf860.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'esp32';
const MQTT_PASS = 'Carefull123';

// server severity → app DiagnosisLevel 매핑
const SEVERITY_MAP: Record<string, DiagnosisLevel> = {
  normal:  'normal',
  warning: 'moderate',
  severe:  'severe',
};

let client: MqttClient | null = null;
let currentDeviceId = '';

export const startMqttListener = (deviceId: string): void => {
  if (client) stopMqttListener();
  currentDeviceId = deviceId;

  useStore.getState().setDevice({ mqttStatus: 'connecting' });

  client = mqtt.connect(MQTT_URL, {
    username:        MQTT_USER,
    password:        MQTT_PASS,
    clientId:        `rn-${deviceId}-${Date.now()}`,
    rejectUnauthorized: false,
    reconnectPeriod: 5000,
    connectTimeout:  15000,
  });

  client.on('connect', () => {
    console.log('[MQTT] 연결됨:', deviceId);
    client!.subscribe(`posture/${deviceId}/result`);
    client!.subscribe(`posture/${deviceId}/alert`);
    useStore.getState().setDevice({ mqttStatus: 'connected' });
  });

  client.on('message', (topic: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString());
      const store = useStore.getState();

      if (topic.endsWith('/result')) {
        // diff_pitch 순서: [C7, T7, T3]
        const [c7, t7, t3] = data.diff_pitch ?? [0, 0, 0];
        store.updatePosture(
          data.score ?? 0,
          c7,
          data.pose_en as PostureType,
        );
        store.setAngles({ c7, t7, t3 });
        store.setDiagnosisLevel(SEVERITY_MAP[data.severity] ?? null);

      } else if (topic.endsWith('/alert')) {
        store.addNotification({
          id:       `alert-${Date.now()}`,
          category: 'posture',
          title:    '자세 경고',
          body:     `${data.pose_kr ?? '불량 자세'} 자세가 감지되었습니다.`,
          timeAgo:  '방금',
          read:     false,
        });
      }
    } catch {}
  });

  client.on('error', (err) => {
    console.warn('[MQTT] 에러:', err.message);
    useStore.getState().setDevice({ mqttStatus: 'error' });
  });

  client.on('close', () => {
    useStore.getState().setDevice({ mqttStatus: 'disconnected' });
  });
};

export const stopMqttListener = (): void => {
  if (client) {
    client.end(true);
    client = null;
    currentDeviceId = '';
  }
};

export const getMqttDeviceId = (): string => currentDeviceId;
