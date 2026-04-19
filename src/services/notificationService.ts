import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, orderBy, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../constants/types';

// Firestore 컬렉션 이름
const NOTIF_COL = 'notifications';

// ── 헬퍼 ────────────────────────────────────────────

// Firestore timestamp → "X분 전" 형식 변환
function toTimeAgo(ts: Timestamp): string {
  const diff = Date.now() - ts.toMillis();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

// ERD type → AppNotification category 매핑
// ERD: "danger" | "report" | "device"
// 앱:  "posture" | "report" | "device"
function typeToCategory(type: string): AppNotification['category'] {
  if (type === 'danger') return 'posture';
  if (type === 'report') return 'report';
  return 'device';
}

function categoryToType(category: AppNotification['category']): string {
  if (category === 'posture') return 'danger';
  return category; // "report" | "device" 그대로
}

// ── 알림 저장 ────────────────────────────────────────
// Firestore 구조: { uid, type, title, message, timestamp }
export const saveNotification = async (
  userId: string,
  notification: Pick<AppNotification, 'category' | 'title' | 'body'>,
) => {
  await addDoc(collection(db, NOTIF_COL), {
    uid: userId,
    type: categoryToType(notification.category),
    title: notification.title,
    message: notification.body,
    timestamp: Timestamp.now(),
  });
};

// ── 알림 목록 조회 ────────────────────────────────────
// uid 기준 필터 후 최신순 정렬
// ※ 첫 실행 시 Firestore 콘솔에서 복합 인덱스(uid + timestamp) 자동 생성 링크가 뜸
export const getNotifications = async (
  userId: string,
): Promise<AppNotification[]> => {
  const q = query(
    collection(db, NOTIF_COL),
    where('uid', '==', userId),
    orderBy('timestamp', 'desc'),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,                                      // Firestore auto-ID
      category: typeToCategory(data.type),
      title: data.title,
      body: data.message,
      timeAgo: toTimeAgo(data.timestamp as Timestamp),
      read: false,
    } satisfies AppNotification;
  });
};

// ── 알림 단건 삭제 (스와이프 삭제 연동) ───────────────
export const deleteNotification = async (notifId: string) => {
  await deleteDoc(doc(db, NOTIF_COL, notifId));
};

// ── 알림 전체 삭제 (기록 초기화) ─────────────────────
export const clearNotifications = async (userId: string) => {
  const q = query(collection(db, NOTIF_COL), where('uid', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};
