import { BleManager, Device, BleError } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { toByteArray, fromByteArray } from 'base64-js';

// ─── C7AI BLE UUID (esp32/main.ino 과 반드시 일치) ───────────────────────────
export const C7_SERVICE_UUID     = '4FAFC201-1FB5-459E-8FCC-C5C9C331914B';

// MAC 주소 (read) → deviceId 확정에 사용. WiFi MAC과 동일한 값.
export const C7_MAC_CHAR_UUID    = 'BEB5483E-36E1-4688-B7F5-EA07361B26A8';

// userId (write) → 앱이 ESP32로 현재 사용자 ID를 전달. ESP32는 MQTT payload에 포함.
export const C7_USERID_CHAR_UUID = 'BEB5483D-36E1-4688-B7F5-EA07361B26A8';

// 자세 데이터 (notify) → WiFi fallback 시 ESP32가 실시간으로 앱으로 전송.
export const C7_DATA_CHAR_UUID   = 'BEB5483F-36E1-4688-B7F5-EA07361B26A8';
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureFrame {
  sensor: 'C7' | 'T3' | 'T7';
  pitch: number;
  roll: number;
  userId: string;
}

const manager = new BleManager();

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
  const device = await manager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
  return device;
};

export const disconnectDevice = async (deviceId: string) => {
  await manager.cancelDeviceConnection(deviceId);
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
  return new TextDecoder().decode(bytes);
};

/**
 * 현재 사용자 ID를 ESP32로 전달합니다.
 * ESP32는 이 값을 MQTT payload의 userId 필드에 포함해 전송합니다.
 * BLE 연결 직후 그리고 userId 변경 시(로그인/로그아웃) 호출합니다.
 */
export const sendUserId = async (device: Device, userId: string): Promise<void> => {
  const bytes = new TextEncoder().encode(userId);
  const base64 = fromByteArray(bytes);
  await device.writeCharacteristicWithResponseForService(
    C7_SERVICE_UUID,
    C7_USERID_CHAR_UUID,
    base64,
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
    const json = new TextDecoder().decode(bytes);
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
