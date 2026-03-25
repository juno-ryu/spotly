import { scoreToGrade, type Grade } from "./scoring/types";

/** 등급 타입 re-export */
export type IndicatorGrade = Grade;

/** 점수(0~100) → 등급 변환 (scoreToGrade 위임) */
export function getGrade(score: number): IndicatorGrade {
  return scoreToGrade(score).grade;
}

/** 등급별 한국어 라벨 */
export const GRADE_LABEL: Record<IndicatorGrade, string> = {
  A: "우수",
  B: "양호",
  C: "보통",
  D: "미흡",
  F: "위험",
};

/** 등급별 hex 색상 (차트, 게이지, 지표 카드 공용) */
export const GRADE_HEX: Record<IndicatorGrade, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};

/** 등급별 텍스트 색상 (Tailwind) */
export const GRADE_COLOR: Record<IndicatorGrade, string> = {
  A: "text-emerald-600",
  B: "text-blue-600",
  C: "text-amber-600",
  D: "text-orange-600",
  F: "text-red-600",
};

/** 등급별 배경색 (Badge용, Tailwind) */
export const GRADE_BG: Record<IndicatorGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  B: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  C: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  D: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  F: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

/** 등급별 PDF 색상 */
export const GRADE_PDF_COLOR: Record<IndicatorGrade, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};
