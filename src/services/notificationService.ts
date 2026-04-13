import { auth, db } from '../lib/firebase';
import { AppNotification } from '../constants/types';

// 알림 저장
export const saveNotification = async (userId: string, notification: AppNotification) => {
  // TODO
};

// 알림 목록 조회
export const getNotifications = async (userId: string): Promise<AppNotification[]> => {
  // TODO
  return [];
};

// 알림 읽음 처리
export const markAsRead = async (userId: string, notificationId: string) => {
  // TODO
};

// 알림 전체 삭제
export const clearNotifications = async (userId: string) => {
  // TODO
};
