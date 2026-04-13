import { auth, db } from '../lib/firebase';
import { DayStats, WeekStats, PostureSnapshot } from '../constants/types';

// 오늘 통계 저장
export const saveTodayStats = async (userId: string, stats: DayStats) => {
  // TODO
};

// 오늘 통계 조회
export const getTodayStats = async (userId: string): Promise<DayStats | null> => {
  // TODO
  return null;
};

// 주간 통계 조회
export const getWeeklyStats = async (userId: string): Promise<WeekStats[]> => {
  // TODO
  return [];
};

// 자세 스냅샷 저장
export const saveSnapshot = async (userId: string, snapshot: PostureSnapshot) => {
  // TODO
};

// 자세 스냅샷 목록 조회
export const getSnapshots = async (userId: string): Promise<PostureSnapshot[]> => {
  // TODO
  return [];
};

// 기록 전체 삭제
export const clearAllStats = async (userId: string) => {
  // TODO
};
