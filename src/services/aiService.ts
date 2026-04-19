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
  body: string;
  bestScore: number;
  trend: string;
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

// ── 로컬 진단 (즉시, LLM 없음) ──────────────────────────
export function buildLocalDiagnosis(angle: number, score: number, weeklyStats: WeekStats[]): LocalDiagnosis {
  let level: DiagnosisLevel;
  if (angle <= 15) level = 'normal';
  else if (angle <= 20) level = 'mild';
  else if (angle <= 30) level = 'moderate';
  else level = 'severe';

  const levelText = { normal: '정상', mild: '경증 거북목', moderate: '중등도 거북목', severe: '중증 거북목' }[level];
  const badgeText = { normal: '정상', mild: '경미', moderate: '주의', severe: '위험' }[level];
  const badgeColor = { normal: COLORS.scoreExcellent, mild: COLORS.info, moderate: COLORS.warning, severe: COLORS.danger }[level];
  const warningIcon = { normal: '✅', mild: 'ℹ️', moderate: '⚠️', severe: '🚨' }[level];

  const description = level === 'normal'
    ? `현재 목 각도 ${angle}°로 정상 범위(5-15°) 내에 있습니다. 자세 점수 ${score}점으로 좋은 상태를 유지하고 있습니다.`
    : `현재 목 각도 ${angle}°로 정상 범위(5-15°)를 벗어났습니다. 자세 점수 ${score}점으로 장시간 유지 시 통증이 발생할 수 있습니다.`;

  const prevScore = weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2].avgScore : score;
  const latestScore = weeklyStats.length >= 1 ? weeklyStats[weeklyStats.length - 1].avgScore : score;
  const diff = latestScore - prevScore;
  const improvementRate = diff >= 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;

  return { level, levelText, badgeText, badgeColor, warningIcon, description, improvementRate };
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
  "body": "주간 분석 내용 2-3문장 (구체적 수치와 개선점 포함)",
  "bestScore": 숫자,
  "trend": "↑ X% 또는 ↓ X%"
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
    todayStats ? `오늘 불량 자세: ${todayStats.summary.badPostureCount}회, 교정 횟수: ${todayStats.summary.correctionCount}회, 사용 시간: ${todayStats.summary.totalUsageTime}` : '',
  ].filter(Boolean).join('\n');

  const text = await callLLM(WEEKLY_SYSTEM_PROMPT, userContent, 512);
  return JSON.parse(text) as WeeklyReport;
}
