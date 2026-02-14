import { SCORING_WEIGHTS } from "../constants/scoring";
import type { ScoreBreakdown } from "../schema";

/** 지표 등급 */
export type IndicatorGrade = "A" | "B" | "C" | "D" | "F";

/** 퍼센트 → 등급 변환 */
export function getGrade(percent: number): IndicatorGrade {
  if (percent >= 80) return "A";
  if (percent >= 60) return "B";
  if (percent >= 40) return "C";
  if (percent >= 20) return "D";
  return "F";
}

/** 등급별 한국어 라벨 */
export const GRADE_LABEL: Record<IndicatorGrade, string> = {
  A: "매우 우수",
  B: "우수",
  C: "보통",
  D: "미흡",
  F: "부족",
};

/** 등급별 텍스트 색상 (Tailwind) */
export const GRADE_COLOR: Record<IndicatorGrade, string> = {
  A: "text-green-600",
  B: "text-blue-600",
  C: "text-yellow-600",
  D: "text-orange-600",
  F: "text-red-600",
};

/** 등급별 배경색 (Badge용, Tailwind) */
export const GRADE_BG: Record<IndicatorGrade, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  F: "bg-red-100 text-red-700",
};

/** 등급별 PDF 색상 */
export const GRADE_PDF_COLOR: Record<IndicatorGrade, string> = {
  A: "#16a34a",
  B: "#2563eb",
  C: "#ca8a04",
  D: "#ea580c",
  F: "#dc2626",
};

/** 지표 키 → 만점 매핑 */
const INDICATOR_MAX: Record<keyof ScoreBreakdown, number> = {
  vitality: SCORING_WEIGHTS.VITALITY,
  competition: SCORING_WEIGHTS.COMPETITION,
  survival: SCORING_WEIGHTS.SURVIVAL,
  residential: SCORING_WEIGHTS.RESIDENTIAL,
  income: SCORING_WEIGHTS.INCOME,
};

/** 지표별 등급 정보 */
export interface IndicatorGradeInfo {
  raw: number;
  max: number;
  percent: number;
  grade: IndicatorGrade;
}

/** ScoreBreakdown → 각 지표의 { raw, max, percent, grade } 계산 */
export function getIndicatorGrades(
  breakdown: ScoreBreakdown,
): Record<keyof ScoreBreakdown, IndicatorGradeInfo> {
  const keys = Object.keys(INDICATOR_MAX) as (keyof ScoreBreakdown)[];

  return Object.fromEntries(
    keys.map((key) => {
      const raw = breakdown[key];
      const max = INDICATOR_MAX[key];
      const percent = Math.round((raw / max) * 100);
      return [key, { raw, max, percent, grade: getGrade(percent) }];
    }),
  ) as Record<keyof ScoreBreakdown, IndicatorGradeInfo>;
}
