import { db } from '../lib/firebase';
import {
  collection, doc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { DayStats, WeekStats } from '../constants/types';

// ── 날짜 헬퍼 ─────────────────────────────────────────
function toYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ── 오늘 통계 저장 ─────────────────────────────────────
export const saveTodayStats = async (userId: string, stats: DayStats) => {
  const today = new Date();
  const docId = `${userId}_${toYYYYMMDD(today)}`;
  await setDoc(doc(db, 'daily_stats', docId), { ...stats, uid: userId });
};

// ── 오늘 통계 조회 ─────────────────────────────────────
export const getTodayStats = async (userId: string): Promise<DayStats | null> => {
  const docId = `${userId}_${toYYYYMMDD(new Date())}`;
  const snap = await getDoc(doc(db, 'daily_stats', docId));
  return snap.exists() ? (snap.data() as DayStats) : null;
};

// ── 주간 통계 저장 ─────────────────────────────────────
export const saveWeeklyStats = async (userId: string, stats: Omit<WeekStats, 'weekLabel'>) => {
  const now = new Date();
  const weekNum = getISOWeekNumber(now);
  const docId = `${userId}_${now.getFullYear()}_${String(weekNum).padStart(2, '0')}`;
  await setDoc(doc(db, 'weekly_stats', docId), { ...stats, uid: userId });
};

// ── 주간 통계 조회 (최근 5주) ──────────────────────────
export const getWeeklyStats = async (userId: string): Promise<WeekStats[]> => {
  const q = query(
    collection(db, 'weekly_stats'),
    where('uid', '==', userId),
    orderBy('uid'),
    limit(5),
  );
  const snap = await getDocs(q);
  if (snap.empty) return [];

  return snap.docs.map((d, i) => ({
    ...(d.data() as Omit<WeekStats, 'weekLabel'>),
    weekLabel: `${i + 1}주`,
  }));
};

// ── 기록 전체 삭제 ─────────────────────────────────────
export const clearAllStats = async (userId: string) => {
  const batch = writeBatch(db);

  const dailySnap = await getDocs(
    query(collection(db, 'daily_stats'), where('uid', '==', userId))
  );
  dailySnap.docs.forEach(d => batch.delete(d.ref));

  const weeklySnap = await getDocs(
    query(collection(db, 'weekly_stats'), where('uid', '==', userId))
  );
  weeklySnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
};
