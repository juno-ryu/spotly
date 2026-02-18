/**
 * 경쟁 강도 점수 (0~100, 높을수록 경쟁 약함 = 창업에 유리)
 *
 * 복합 지표: 밀집도(75%) + 프랜차이즈 U커브(25%)
 */
// ────────────────────────────────────────────────────────────
// 공통 스코어링 타입
// ────────────────────────────────────────────────────────────

/** 등급 코드 */
export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

/** 지표별 공통 점수 인터페이스 */
export interface IndicatorScore {
  /** 점수 (0~100) */
  score: number;
  /** 등급 (S~F) */
  grade: Grade;
  /** 등급 라벨 (예: "최상", "우수") */
  gradeLabel: string;
}

/** 등급 산출 기준표 */
const GRADE_TABLE: { min: number; grade: Grade; label: string }[] = [
  { min: 90, grade: "S", label: "최상" },
  { min: 75, grade: "A", label: "우수" },
  { min: 60, grade: "B", label: "양호" },
  { min: 45, grade: "C", label: "보통" },
  { min: 30, grade: "D", label: "미흡" },
  { min: 0, grade: "F", label: "위험" },
];

/** 점수 → 등급 변환 */
export function scoreToGrade(score: number): { grade: Grade; gradeLabel: string } {
  const clamped = Math.round(Math.max(0, Math.min(100, score)));
  const entry = GRADE_TABLE.find((g) => clamped >= g.min) ?? GRADE_TABLE.at(-1)!;
  return { grade: entry.grade, gradeLabel: entry.label };
}

/** 선형 정규화: value를 [min, max] → [0, 1] 범위로 매핑 후 clamp */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ────────────────────────────────────────────────────────────
// 경쟁 강도 (Competition) 전용 타입
// ────────────────────────────────────────────────────────────

export interface CompetitionScore {
  /** 점수 (0~100) */
  score: number;
  /** 등급 (A~F) */
  grade: string;
  /** 등급 라벨 */
  gradeLabel: string;
}

/** 경쟁 분석 결과 */
export interface CompetitionAnalysis {
  /** 밀집도: 약 N미터당 1개 매장 */
  densityPerMeter: number;
  /** 업종별 밀집도 기준값 (미터) */
  densityBaseline: number;
  /** 직접 경쟁 매장 수 (카테고리에 업종 키워드 포함) */
  directCompetitorCount: number;
  /** 간접 경쟁 매장 수 */
  indirectCompetitorCount: number;
  /** 직접 경쟁 비율 (0~1) */
  directCompetitorRatio: number;
  /** 프랜차이즈 매장 수 */
  franchiseCount: number;
  /** 프랜차이즈 비율 (0~1, U커브 점수에 반영) */
  franchiseRatio: number;
  /** 감지된 프랜차이즈 브랜드명 목록 */
  franchiseBrandNames: string[];
  /** 경쟁 강도 점수 (0~100) */
  competitionScore: CompetitionScore;
}
