import { BleManager, Device, BleError } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { toByteArray } from 'base64-js';

// ─── 기기 UUID 설정 (하드웨어팀에게 받아서 채울 것) ───────────────────────
export const C7_SERVICE_UUID = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
export const C7_CHARACTERISTIC_UUID = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
// ─────────────────────────────────────────────────────────────────────────────

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

// 주변 BLE 기기 스캔
// onDeviceFound: 기기 발견 시 콜백
// onError: 에러 시 콜백
export const startScan = (
  onDeviceFound: (device: Device) => void,
  onError: (error: BleError) => void
) => {
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      onError(error);
      return;
    }
    if (device) {
      onDeviceFound(device);
    }
  });
};

// 스캔 중단
export const stopScan = () => {
  manager.stopDeviceScan();
};

// 기기 연결
export const connectToDevice = async (deviceId: string): Promise<Device> => {
  const device = await manager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
  return device;
};

// 기기 연결 해제
export const disconnectDevice = async (deviceId: string) => {
  await manager.cancelDeviceConnection(deviceId);
};

// 자세 데이터 실시간 구독
// onData: 각도값 수신 시 콜백
export const subscribePostureData = (
  device: Device,
  onData: (angle: number) => void,
  onError: (error: BleError) => void
) => {
  device.monitorCharacteristicForService(
    C7_SERVICE_UUID,
    C7_CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        onError(error);
        return;
      }
      if (characteristic?.value) {
        const angle = parsePostureData(characteristic.value);
        onData(angle);
      }
    }
  );
};

// 기기에서 받은 raw 데이터 → 각도값 변환
// TODO: 하드웨어팀에게 데이터 포맷 확인 후 파싱 로직 구현
const parsePostureData = (base64Value: string): number => {
  const bytes = toByteArray(base64Value);
  // TODO: 실제 데이터 포맷에 맞게 수정
  return bytes[0];
};

// BleManager 정리 (앱 종료 시 호출)
export const destroyBleManager = () => {
  manager.destroy();
};
