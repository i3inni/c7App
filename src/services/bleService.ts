import { BleManager, Device, BleError } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { toByteArray, fromByteArray } from 'base64-js';
import { useStore } from '../store';

// ─── C7AI BLE UUID (esp32/main.ino 과 반드시 일치) ───────────────────────────
export const C7_SERVICE_UUID     = '4FAFC201-1FB5-459E-8FCC-C5C9C331914B';

// MAC 주소 (read) → deviceId 확정에 사용. WiFi MAC과 동일한 값.
export const C7_MAC_CHAR_UUID    = 'BEB5483E-36E1-4688-B7F5-EA07361B26A8';

// userId (write) → 앱이 ESP32로 현재 사용자 ID를 전달. ESP32는 MQTT payload에 포함.
export const C7_USERID_CHAR_UUID = 'BEB5483D-36E1-4688-B7F5-EA07361B26A8';

// 자세 데이터 (notify) → WiFi fallback 시 ESP32가 실시간으로 앱으로 전송.
export const C7_DATA_CHAR_UUID   = 'BEB5483F-36E1-4688-B7F5-EA07361B26A8';

// WiFi Provisioning
export const C7_WIFI_LIST_CHAR_UUID   = 'BEB54840-36E1-4688-B7F5-EA07361B26A8';
export const C7_WIFI_CRED_CHAR_UUID   = 'BEB54841-36E1-4688-B7F5-EA07361B26A8';
export const C7_WIFI_STATUS_CHAR_UUID = 'BEB54842-36E1-4688-B7F5-EA07361B26A8';
export const C7_WIFI_SCAN_CHAR_UUID   = 'BEB54843-36E1-4688-B7F5-EA07361B26A8';
export const C7_POWER_CHAR_UUID       = 'BEB54844-36E1-4688-B7F5-EA07361B26A8';
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureFrame {
  sensor: 'C7' | 'T3' | 'T7';
  pitch: number;
  roll: number;
  userId: string;
}

export interface WifiNetwork {
  ssid: string;
  secured: boolean;
}

const manager = new BleManager();
const disconnectSubscriptions = new Map<string, { remove: () => void }>();

const watchDisconnection = (deviceId: string) => {
  disconnectSubscriptions.get(deviceId)?.remove();
  const sub = manager.onDeviceDisconnected(deviceId, () => {
    useStore.getState().setDevice({ bleConnected: false });
  });
  if (sub) disconnectSubscriptions.set(deviceId, sub);
};

// 안드로이드 블루투스 권한 요청
export const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);

  return Object.values(granted).every(
    (v) => v === PermissionsAndroid.RESULTS.GRANTED
  );
};

// C7AI 서비스 UUID로 필터링해 스캔 (C7AI 기기만 보임)
export const startScan = (
  onDeviceFound: (device: Device) => void,
  onError: (error: BleError) => void
) => {
  manager.startDeviceScan(
    [C7_SERVICE_UUID],
    { allowDuplicates: false },
    (error, device) => {
      if (error) { onError(error); return; }
      if (device) onDeviceFound(device);
    }
  );
};

export const stopScan = () => {
  manager.stopDeviceScan();
};

export const connectToDevice = async (deviceId: string): Promise<Device> => {
  const device = await manager.connectToDevice(deviceId, { requestMTU: 512 });
  await device.discoverAllServicesAndCharacteristics();
  useStore.getState().setDevice({ bleConnected: true });
  watchDisconnection(deviceId);
  return device;
};

export const disconnectDevice = async (deviceId: string) => {
  await manager.cancelDeviceConnection(deviceId);
  disconnectSubscriptions.get(deviceId)?.remove();
  disconnectSubscriptions.delete(deviceId);
  useStore.getState().setDevice({ bleConnected: false });
};

/**
 * ESP32에서 WiFi MAC 주소를 읽어 deviceId로 반환합니다.
 * 반환값 예시: "a4cf12987711" (소문자, 콜론 없음)
 *
 * 로그인 없이도 deviceId를 확정할 수 있어 비회원 지원의 핵심입니다.
 */
export const readDeviceId = async (device: Device): Promise<string> => {
  const char = await device.readCharacteristicForService(
    C7_SERVICE_UUID,
    C7_MAC_CHAR_UUID,
  );
  if (!char.value) throw new Error('MAC characteristic 값 없음');
  const bytes = toByteArray(char.value);
  return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
};

/**
 * 현재 사용자 ID를 ESP32로 전달합니다.
 * ESP32는 이 값을 MQTT payload의 userId 필드에 포함해 전송합니다.
 * BLE 연결 직후 그리고 userId 변경 시(로그인/로그아웃) 호출합니다.
 */
const strToBase64 = (str: string): string => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return fromByteArray(bytes);
};

export const sendUserId = async (device: Device, userId: string): Promise<void> => {
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_USERID_CHAR_UUID,
    strToBase64(userId),
  );
};

/**
 * BLE fallback 모드에서 실시간 자세 프레임을 구독합니다.
 * WiFi/MQTT 연결 실패 시 ESP32가 이 characteristic으로 데이터를 notify합니다.
 * 각 notify는 단일 센서 JSON: { sensor, pitch, roll, userId }
 *
 * 반환값: 구독 해제 함수 (컴포넌트 unmount 시 호출)
 */
export const subscribeFallbackData = (
  device: Device,
  onFrame: (frame: PostureFrame) => void,
  onError: (error: BleError) => void
): (() => void) => {
  const subscription = device.monitorCharacteristicForService(
    C7_SERVICE_UUID,
    C7_DATA_CHAR_UUID,
    (error, characteristic) => {
      if (error) { onError(error); return; }
      if (characteristic?.value) {
        const frame = parseFallbackFrame(characteristic.value);
        if (frame) onFrame(frame);
      }
    }
  );
  return () => subscription.remove();
};

const parseFallbackFrame = (base64Value: string): PostureFrame | null => {
  try {
    const bytes = toByteArray(base64Value);
    const json = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    const data = JSON.parse(json);
    if (
      (data.sensor === 'C7' || data.sensor === 'T3' || data.sensor === 'T7') &&
      typeof data.pitch === 'number' &&
      typeof data.roll === 'number'
    ) {
      return {
        sensor:  data.sensor,
        pitch:   data.pitch,
        roll:    data.roll,
        userId:  data.userId ?? 'unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const destroyBleManager = () => {
  manager.destroy();
};

// ─── WiFi Provisioning ────────────────────────────────────────────────────────

export const readWifiList = async (device: Device): Promise<string[]> => {
  const char = await device.readCharacteristicForService(
    C7_SERVICE_UUID,
    C7_WIFI_LIST_CHAR_UUID,
  );
  if (!char.value) throw new Error('WiFi list 값 없음(null)');
  const bytes = toByteArray(char.value);
  const json = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  const parsed = JSON.parse(json); // parse 실패 시 에러 전파 → 폴링에서 에러 메시지로 표시됨
  return Array.isArray(parsed) ? parsed : [];
};

// Arduino 프로토콜: "SCAN_START" → "SSID:<name>:<0|1>" × N → "SCAN_END"
// 0 = 오픈 네트워크, 1 = 비밀번호 필요
// lastIndexOf(':') 로 파싱해서 SSID에 ':' 포함돼도 안전
export const subscribeWifiList = (
  device: Device,
  onList: (networks: WifiNetwork[]) => void,
): (() => void) => {
  let buffer: WifiNetwork[] = [];
  const sub = device.monitorCharacteristicForService(
    C7_SERVICE_UUID,
    C7_WIFI_LIST_CHAR_UUID,
    (err, char) => {
      if (err || !char?.value) return;
      const msg = Array.from(toByteArray(char.value))
        .map(b => String.fromCharCode(b)).join('');
      if (msg === 'SCAN_START') { buffer = []; return; }
      if (msg === 'SCAN_END')   { onList([...buffer]); buffer = []; return; }
      if (msg.startsWith('SSID:')) {
        const content   = msg.slice(5);                          // "MyNetwork:1"
        const lastColon = content.lastIndexOf(':');
        if (lastColon === -1) return;
        const ssid    = content.slice(0, lastColon);
        const secured = content.slice(lastColon + 1) !== '0';
        buffer.push({ ssid, secured });
      }
    }
  );
  return () => sub.remove();
};

export const sendWifiCredentials = async (
  device: Device,
  ssid: string,
  password: string,
): Promise<void> => {
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_WIFI_CRED_CHAR_UUID,
    strToBase64(JSON.stringify({ ssid, password })),
  );
};

export type WifiStatusEvent =
  | { type: 'success' }
  | { type: 'fail' }
  | { type: 'disconnected' }
  | { type: 'connected'; ssid: string };

export const subscribeWifiStatus = (
  device: Device,
  onStatus: (event: WifiStatusEvent) => void,
): (() => void) => {
  const sub = device.monitorCharacteristicForService(
    C7_SERVICE_UUID,
    C7_WIFI_STATUS_CHAR_UUID,
    (err, char) => {
      if (err || !char?.value) return;
      const msg = Array.from(toByteArray(char.value))
        .map(b => String.fromCharCode(b)).join('');
      if (msg === 'success')      onStatus({ type: 'success' });
      else if (msg === 'fail')    onStatus({ type: 'fail' });
      else if (msg === 'disconnected') onStatus({ type: 'disconnected' });
      else if (msg.startsWith('connected:')) onStatus({ type: 'connected', ssid: msg.slice(10) });
    }
  );
  return () => sub.remove();
};

export const triggerWifiScan = async (device: Device): Promise<void> => {
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_WIFI_SCAN_CHAR_UUID,
    strToBase64('scan'),
  );
};

export interface PowerStatus {
  mode: 'on' | 'eco' | 'off';
  cpu: number;
  interval: number;
}

export const sendPowerMode = async (
  device: Device,
  mode: 'on' | 'eco' | 'off',
): Promise<void> => {
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_POWER_CHAR_UUID,
    strToBase64(mode),
  );
};

export const subscribePowerStatus = (
  device: Device,
  onStatus: (status: PowerStatus) => void,
): (() => void) => {
  const sub = device.monitorCharacteristicForService(
    C7_SERVICE_UUID,
    C7_POWER_CHAR_UUID,
    (err, char) => {
      if (err || !char?.value) return;
      try {
        const json = Array.from(toByteArray(char.value))
          .map(b => String.fromCharCode(b)).join('');
        const data = JSON.parse(json);
        if (data.mode && data.cpu && data.interval) onStatus(data as PowerStatus);
      } catch {}
    }
  );
  return () => sub.remove();
};

export const sendDisconnectCommand = async (device: Device): Promise<void> => {
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_WIFI_SCAN_CHAR_UUID,
    strToBase64('disconnect'),
  );
};
