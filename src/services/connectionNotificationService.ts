import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useStore } from '../store';
import { saveNotification } from './notificationService';

type DeviceSnapshot = {
  bleConnected: boolean;
  wifiConnected: boolean;
  mqttStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  powerOn: boolean;
  deviceId: string | null;
};

const BLE_DISCONNECT_DELAY_MS = 30_000;
const BLE_DISCONNECT_COOLDOWN_MS = 30_000;
const WIFI_DISCONNECT_DELAY_MS = 30_000;
const WIFI_DISCONNECT_COOLDOWN_MS = 30_000;

let initialized = false;
let unsubscribeStore: (() => void) | null = null;
let previousState: DeviceSnapshot | null = null;

let bleDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wifiDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

let lastBleDisconnectAt = 0;
let lastWifiDisconnectAt = 0;
let wifiDisconnectAlertSent = false;

const selectDeviceState = (): DeviceSnapshot => {
  const device = useStore.getState().device;
  return {
    bleConnected: device.bleConnected,
    wifiConnected: device.wifiConnected,
    mqttStatus: device.mqttStatus,
    powerOn: device.powerOn,
    deviceId: device.deviceId,
  };
};

const clearBleTimer = () => {
  if (bleDisconnectTimer) {
    clearTimeout(bleDisconnectTimer);
    bleDisconnectTimer = null;
  }
};

const clearWifiTimer = () => {
  if (wifiDisconnectTimer) {
    clearTimeout(wifiDisconnectTimer);
    wifiDisconnectTimer = null;
  }
};

const ensureNotificationsReady = async () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const silent = Boolean(notification.request.content.data?.silent);
      return {
        shouldShowAlert: true,
        shouldPlaySound: !silent,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  const perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('connection-default', {
      name: '기기 연결 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 200, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('connection-quiet', {
      name: '기기 연결 알림(조용히)',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      sound: undefined,
    });
  }
};

const pushLocalNotification = async (title: string, body: string, silent = false) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { silent },
        sound: silent ? undefined : 'default',
        ...(Platform.OS === 'ios'
          ? { interruptionLevel: silent ? 'passive' : 'active' }
          : { channelId: silent ? 'connection-quiet' : 'connection-default' }),
      },
      trigger: null,
    });
  } catch {}
};

const emitDeviceNotification = async ({
  title,
  body,
  silent = false,
}: {
  title: string;
  body: string;
  silent?: boolean;
}) => {
  const { user, addNotification } = useStore.getState();
  const localId = `local-${Date.now()}`;

  addNotification({
    id: localId,
    category: 'device',
    title,
    body,
    timeAgo: '방금 전',
    read: false,
  });

  if (user?.id) {
    try {
      const id = await saveNotification(user.id, { category: 'device', title, body });
      useStore.getState().removeNotification(localId);
      useStore.getState().addNotification({
        id,
        category: 'device',
        title,
        body,
        timeAgo: '방금 전',
        read: false,
      });
    } catch {}
  }

  await pushLocalNotification(title, body, silent);
};

const handleBleDisconnected = () => {
  clearBleTimer();
  bleDisconnectTimer = setTimeout(async () => {
    const now = Date.now();
    const current = selectDeviceState();
    if (!current.bleConnected && current.powerOn && current.deviceId && now - lastBleDisconnectAt >= BLE_DISCONNECT_COOLDOWN_MS) {
      lastBleDisconnectAt = now;
      await emitDeviceNotification({
        title: '기기 연결이 끊어졌어요',
        body: '전원과 거리를 확인해 주세요',
      });
    }
  }, BLE_DISCONNECT_DELAY_MS);
};

const handleWifiDisconnected = () => {
  clearWifiTimer();
  wifiDisconnectTimer = setTimeout(async () => {
    const now = Date.now();
    const current = selectDeviceState();
    if (!current.wifiConnected && current.powerOn && now - lastWifiDisconnectAt >= WIFI_DISCONNECT_COOLDOWN_MS) {
      lastWifiDisconnectAt = now;
      wifiDisconnectAlertSent = true;
      await emitDeviceNotification({
        title: '기기가 인터넷에 연결되지 않았어요',
        body: '실시간 측정은 계속되지만, 자세 데이터가 서버에 저장되지 않고 있어요',
      });
    }
  }, WIFI_DISCONNECT_DELAY_MS);
};

const onDeviceStateChange = (next: DeviceSnapshot, prev: DeviceSnapshot) => {
  if (!next.powerOn || !next.deviceId) {
    clearBleTimer();
    clearWifiTimer();
    return;
  }

  if (prev.bleConnected && !next.bleConnected) {
    handleBleDisconnected();
  }
  if (!prev.bleConnected && next.bleConnected) {
    clearBleTimer();
  }

  if (prev.wifiConnected && !next.wifiConnected) {
    if (useStore.getState().device.connectedSsid) {
      useStore.getState().setDevice({ connectedSsid: null });
    }
    handleWifiDisconnected();
  }

  if (!prev.wifiConnected && next.wifiConnected) {
    clearWifiTimer();
    if (wifiDisconnectAlertSent) {
      wifiDisconnectAlertSent = false;
      emitDeviceNotification({
        title: '인터넷이 다시 연결됐어요',
        body: '오프라인 동안 저장된 데이터를 서버로 전송하고 있어요',
        silent: true,
      });
    }
  }
};

export const markManualBleDisconnect = (_durationMs = 60_000) => {
  clearBleTimer();
};

export const initConnectionNotifications = () => {
  if (initialized) return;
  initialized = true;
  void ensureNotificationsReady();

  previousState = selectDeviceState();
  unsubscribeStore = useStore.subscribe((state) => {
    const next = {
      bleConnected: state.device.bleConnected,
      wifiConnected: state.device.wifiConnected,
      mqttStatus: state.device.mqttStatus,
      powerOn: state.device.powerOn,
      deviceId: state.device.deviceId,
    };

    if (previousState) {
      onDeviceStateChange(next, previousState);
    }
    previousState = next;
  });
};

export const teardownConnectionNotifications = () => {
  unsubscribeStore?.();
  unsubscribeStore = null;
  initialized = false;
  previousState = null;
  clearBleTimer();
  clearWifiTimer();
};
