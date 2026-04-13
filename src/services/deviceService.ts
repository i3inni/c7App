import { auth, db } from '../lib/firebase';
import { DeviceState } from '../constants/types';

// 기기 설정 저장
export const saveDeviceSettings = async (userId: string, device: Partial<DeviceState>) => {
  // TODO
};

// 기기 설정 조회
export const getDeviceSettings = async (userId: string): Promise<DeviceState | null> => {
  // TODO
  return null;
};

// 기기 연결 상태 업데이트
export const updateDeviceConnection = async (userId: string, deviceId: string, connected: boolean) => {
  // TODO
};
