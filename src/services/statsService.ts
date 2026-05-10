import { db } from '../lib/firebase';
import {
  collection, doc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit, writeBatch, documentId,
  startAt, endAt,
} from 'firebase/firestore';
import { DayStats, WeekStats } from '../constants/types';

// ── 날짜 헬퍼 ─────────────────────────────────────────

function toYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * monthOffset=0 → "2026-05", monthOffset=1 → "2026-04"
 * weekly_stats 문서 ID 접두사로 사용합니다.
 */
function toPeriodMonth(monthOffset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
// 문서 ID: {userId}_{YYYY-MM}_{weekIndex}  (예: uid_2026-05_3)
export const saveWeeklyStats = async (
  userId: string,
  stats: Omit<WeekStats, 'weekLabel'>,
  weekIndex: number,       // 해당 월의 몇 번째 주 (1~5)
  monthOffset = 0,
) => {
  const periodMonth = toPeriodMonth(monthOffset);
  const docId = `${userId}_${periodMonth}_${weekIndex}`;
  await setDoc(doc(db, 'weekly_stats', docId), {
    ...stats,
    uid: userId,
    periodMonth,
    weekIndex,
  });
};

// ── 주간 통계 조회 — 월별 분리 ─────────────────────────
// 문서 ID 범위 쿼리: {userId}_{YYYY-MM}_1 ~ {userId}_{YYYY-MM}_~
// 인덱스 불필요 (documentId() 정렬)
export const getWeeklyStats = async (
  userId: string,
  monthOffset = 0,
): Promise<WeekStats[]> => {
  const periodMonth = toPeriodMonth(monthOffset);
  const prefix    = `${userId}_${periodMonth}_`;
  const prefixEnd = `${userId}_${periodMonth}_~`; // '~'(0x7E) > '9' → 범위 끝

  const q = query(
    collection(db, 'weekly_stats'),
    orderBy(documentId()),
    startAt(prefix),
    endAt(prefixEnd),
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
