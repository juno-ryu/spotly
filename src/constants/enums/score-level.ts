/** 점수 등급 */
export const ScoreLevel = {
  /** 강력 추천 (80~100점) */
  EXCELLENT: "EXCELLENT",
  /** 조건부 추천 (60~79점) */
  GOOD: "GOOD",
  /** 주의 필요 (40~59점) */
  CAUTION: "CAUTION",
  /** 비추천 (0~39점) */
  POOR: "POOR",
} as const;
export type ScoreLevel = (typeof ScoreLevel)[keyof typeof ScoreLevel];

/** 점수에 해당하는 등급 반환 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 80) return ScoreLevel.EXCELLENT;
  if (score >= 60) return ScoreLevel.GOOD;
  if (score >= 40) return ScoreLevel.CAUTION;
  return ScoreLevel.POOR;
}

/** 등급별 한국어 라벨 */
export const SCORE_LEVEL_LABEL: Record<ScoreLevel, string> = {
  [ScoreLevel.EXCELLENT]: "강력 추천",
  [ScoreLevel.GOOD]: "조건부 추천",
  [ScoreLevel.CAUTION]: "주의 필요",
  [ScoreLevel.POOR]: "비추천",
} as const;
