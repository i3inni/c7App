import { db } from '../lib/firebase';
import {
  collection, doc, getDoc, getDocs, setDoc,
  query, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { DayStats, WeekStats, PostureSnapshot } from '../constants/types';

const dailyRef = (uid: string, date: string) =>
  doc(db, 'users', uid, 'dailyStats', date);
const snapshotRef = (uid: string, id: string) =>
  doc(db, 'users', uid, 'snapshots', id);

// ── 오늘 통계 저장 ────────────────────────────────────
export const saveTodayStats = async (userId: string, stats: DayStats) => {
  await setDoc(dailyRef(userId, stats.date), stats);
};

// ── 오늘 통계 조회 ────────────────────────────────────
export const getTodayStats = async (userId: string): Promise<DayStats | null> => {
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDoc(dailyRef(userId, today));
  return snap.exists() ? (snap.data() as DayStats) : null;
};

// ── 주간 통계 조회 (최근 35일 일별 데이터 → 주차별 집계) ──
export const getWeeklyStats = async (userId: string): Promise<WeekStats[]> => {
  const q = query(
    collection(db, 'users', userId, 'dailyStats'),
    orderBy('date', 'desc'),
    limit(35),
  );
  const snap = await getDocs(q);
  if (snap.empty) return [];

  const days = snap.docs.map(d => d.data() as DayStats);

  // ISO 주차별 그룹핑
  const weekMap = new Map<string, number[]>();
  days.forEach(d => {
    const date = new Date(d.date);
    const week = getISOWeekKey(date);
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week)!.push(d.dailyScore);
  });

  const weeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-5);

  return weeks.map(([, scores], i) => {
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const prevAvg = i > 0
      ? Math.round(weeks[i - 1][1].reduce((s, v) => s + v, 0) / weeks[i - 1][1].length)
      : avgScore;
    return {
      weekLabel: `${i + 1}주`,
      avgScore,
      scoreChange: avgScore - prevAvg,
    };
  });
};

// ── 자세 스냅샷 저장 ──────────────────────────────────
export const saveSnapshot = async (userId: string, snapshot: PostureSnapshot) => {
  await setDoc(snapshotRef(userId, snapshot.id), snapshot);
};

// ── 자세 스냅샷 목록 조회 (최근 100개) ───────────────
export const getSnapshots = async (userId: string): Promise<PostureSnapshot[]> => {
  const q = query(
    collection(db, 'users', userId, 'snapshots'),
    orderBy('timestamp', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PostureSnapshot);
};

// ── 기록 전체 삭제 ────────────────────────────────────
export const clearAllStats = async (userId: string) => {
  const batch = writeBatch(db);

  const dailySnap = await getDocs(collection(db, 'users', userId, 'dailyStats'));
  dailySnap.docs.forEach(d => batch.delete(d.ref));

  const snapshotSnap = await getDocs(collection(db, 'users', userId, 'snapshots'));
  snapshotSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
};

// ── 유틸 ─────────────────────────────────────────────
function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const year = d.getFullYear();
  const week = Math.ceil(((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
