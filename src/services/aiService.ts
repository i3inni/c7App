import { DayStats, WeekStats } from '../constants/types';
import { COLORS } from '../constants/theme';

const API_KEY = process.env.EXPO_PUBLIC_MINDLOGIC_API_KEY ?? '';
const BASE_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
const MODEL = 'gpt-5.3-chat-latest';

export type DiagnosisLevel = 'normal' | 'mild' | 'moderate' | 'severe';

export interface ExerciseStep {
  title: string;
  desc: string;
  reps: string;
  tip: string;
}

export interface LocalDiagnosis {
  level: DiagnosisLevel;
  levelText: string;
  badgeText: string;
  badgeColor: string;
  warningIcon: string;
  description: string;
  improvementRate: string;
}

export interface WeeklyReport {
  summary: string;        // 종합 평가 2문장
  bestScore: number;      // 주간 최고 점수
  avgScore: number;       // 주간 평균 점수
  trend: string;          // "↑ X%" 또는 "↓ X%"
  insight: string;        // 핵심 인사이트 1문장
  recommendation: string; // 개선 추천 1문장
}

// ── 공통 fetch 헬퍼 ──────────────────────────────────────
async function callLLM(systemPrompt: string, userContent: string, maxTokens = 512): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API 오류 (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.choices[0].message.content as string;
}

// ── 레벨/배지 계산 (각도 기반, UI용) ────────────────────
export function classifyLevel(angle: number): DiagnosisLevel {
  if (angle <= 15) return 'normal';
  if (angle <= 20) return 'mild';
  if (angle <= 30) return 'moderate';
  return 'severe';
}

export function levelToMeta(level: DiagnosisLevel) {
  return {
    levelText:  { normal: '정상', mild: '경증 거북목', moderate: '중등도 거북목', severe: '중증 거북목' }[level],
    badgeText:  { normal: '정상', mild: '경미', moderate: '주의', severe: '위험' }[level],
    badgeColor: { normal: COLORS.scoreExcellent, mild: COLORS.info, moderate: COLORS.warning, severe: COLORS.danger }[level],
    warningIcon:{ normal: '✅', mild: 'ℹ️', moderate: '⚠️', severe: '🚨' }[level],
  };
}

const POSTURE_TYPE_LABEL: Record<string, string> = {
  normal:       '정상 자세',
  forward_head: '거북목 (전방 머리 자세)',
  rounded_back: '굽은 등',
  straight_neck:'일자목',
  tilted:       '기울어진 자세',
  unknown:      '감지 중',
};

// ── LLM 진단 ─────────────────────────────────────────────
export interface LLMDiagnosis {
  description: string;    // 현재 자세 상태 설명 2문장
  improvementRate: string; // "+X% 또는 -X%"
  riskMessage: string;    // 지속 시 위험/긍정 메시지
  actionTip: string;      // 즉시 실천 팁
}

const DIAGNOSIS_SYSTEM_PROMPT = `당신은 거북목 교정 전문 의료 AI입니다. 사용자의 자세 감지 데이터를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "description": "감지된 자세 유형과 현재 상태에 대한 구체적인 설명 2문장 (수치 포함)",
  "improvementRate": "+X% 또는 -X% (지난주 대비 개선율)",
  "riskMessage": "현재 자세가 지속될 경우의 경고 또는 긍정 메시지 1문장",
  "actionTip": "지금 당장 할 수 있는 교정 팁 1문장"
}`;

export async function analyzeDiagnosis(
  postureType: string,
  angle: number,
  score: number,
  weeklyStats: WeekStats[],
  todayStats: DayStats | null,
): Promise<LLMDiagnosis> {
  const postureLabel = POSTURE_TYPE_LABEL[postureType] ?? postureType;
  const prevScore = weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2].avgScore : score;
  const latestScore = weeklyStats.length >= 1 ? weeklyStats[weeklyStats.length - 1].avgScore : score;

  const userContent = [
    `감지된 자세: ${postureLabel}`,
    `현재 목 각도: ${angle}°, 자세 점수: ${score}점`,
    `지난주 평균: ${prevScore}점 → 이번주 평균: ${latestScore}점`,
    todayStats
      ? `오늘 불량 자세: ${todayStats.badPostureCount}회, 교정: ${todayStats.correctionCount}회`
      : '',
  ].filter(Boolean).join('\n');

  const text = await callLLM(DIAGNOSIS_SYSTEM_PROMPT, userContent, 400);
  return JSON.parse(text) as LLMDiagnosis;
}

// ── 단계별 운동 솔루션 (LLM) ─────────────────────────────
const EXERCISE_SYSTEM_PROMPT = `당신은 거북목 교정 전문 물리치료사 AI입니다. 사용자의 목 상태에 맞는 단계별 교정 운동 3가지를 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

[
  { "title": "운동명", "desc": "구체적 동작 설명 2문장 (어떻게 하는지 명확하게)", "reps": "X초 × Y회", "tip": "주의사항 또는 효과 1문장" },
  { "title": "운동명", "desc": "구체적 동작 설명 2문장", "reps": "X초 × Y회", "tip": "주의사항 또는 효과 1문장" },
  { "title": "운동명", "desc": "구체적 동작 설명 2문장", "reps": "X초 × Y회", "tip": "주의사항 또는 효과 1문장" }
]

난이도는 1단계(쉬움) → 2단계(보통) → 3단계(강화)로 구성하세요.`;

export async function analyzeExercises(
  level: DiagnosisLevel,
  angle: number,
  score: number,
): Promise<[ExerciseStep, ExerciseStep, ExerciseStep]> {
  const levelText = { normal: '정상', mild: '경증 거북목', moderate: '중등도 거북목', severe: '중증 거북목' }[level];
  const userContent = `진단 결과: ${levelText}\n현재 목 각도: ${angle}°\n자세 점수: ${score}점\n\n이 상태에 맞는 단계별 교정 운동 3가지를 추천해주세요.`;

  const text = await callLLM(EXERCISE_SYSTEM_PROMPT, userContent, 768);
  const parsed = JSON.parse(text) as ExerciseStep[];
  return [parsed[0], parsed[1], parsed[2]];
}

// ── 주간 리포트 (LLM) ────────────────────────────────────
const WEEKLY_SYSTEM_PROMPT = `당신은 거북목 교정 전문 AI입니다. 사용자의 주간 자세 데이터를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "summary": "이번 주 자세 상태 종합 평가 2문장 (구체적 수치 포함)",
  "bestScore": 숫자,
  "avgScore": 숫자,
  "trend": "↑ X% 또는 ↓ X%",
  "insight": "가장 주목할 만한 패턴이나 변화 1문장",
  "recommendation": "다음 주를 위한 가장 중요한 개선 행동 1문장"
}`;

export async function analyzeWeeklyReport(
  currentScore: number,
  todayStats: DayStats | null,
  weeklyStats: WeekStats[],
): Promise<WeeklyReport> {
  const weekScores = weeklyStats.map((w) => `${w.weekLabel}: ${w.avgScore}점`).join(', ');
  const prevScore = weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2].avgScore : currentScore;
  const latestScore = weeklyStats.length >= 1 ? weeklyStats[weeklyStats.length - 1].avgScore : currentScore;
  const bestScore = Math.max(...weeklyStats.map((w) => w.avgScore), currentScore);

  const userContent = [
    `현재 자세 점수: ${currentScore}점`,
    weekScores ? `주간 점수 추이: ${weekScores}` : '',
    `지난주 점수: ${prevScore}점, 이번 주 점수: ${latestScore}점, 최고 점수: ${bestScore}점`,
    todayStats ? `오늘 불량 자세: ${todayStats.badPostureCount}회, 교정 횟수: ${todayStats.correctionCount}회, 사용 시간: ${todayStats.totalUsageTime}시간` : '',
  ].filter(Boolean).join('\n');

  const text = await callLLM(WEEKLY_SYSTEM_PROMPT, userContent, 512);
  return JSON.parse(text) as WeeklyReport;
}
