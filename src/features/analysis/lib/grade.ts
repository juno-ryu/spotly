/** 지표 등급 (A~F, 5등급) */
export type IndicatorGrade = "A" | "B" | "C" | "D" | "F";

/** 점수(0~100) → 등급 변환 */
export function getGrade(score: number): IndicatorGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

/** 등급별 한국어 라벨 */
export const GRADE_LABEL: Record<IndicatorGrade, string> = {
  A: "우수",
  B: "양호",
  C: "보통",
  D: "미흡",
  F: "위험",
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
