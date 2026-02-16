/** 인사이트 카테고리 — 내부 구분용, UI 노출 안 함 */
export type InsightCategory = "scoring" | "fact";

/** 인사이트 항목 */
export interface InsightItem {
  type: "text";
  emoji: string;
  text: string;
  sub?: string;
  /** 내부 구분용 — 스코어 반영 여부 (UI 노출 안 함) */
  category: InsightCategory;
}

/** 경쟁 분석 데이터 */
export interface CompetitionAnalysis {
  densityPerMeter: number;
  directCompetitorCount: number;
  indirectCompetitorCount: number;
  franchiseCount: number;
  franchiseRatio: number;
  franchiseBrandNames: string[];
  /** 경쟁 강도 점수 (0~100, 높을수록 유리) */
  competitionScore?: {
    score: number;
    grade: string;
    gradeLabel: string;
  };
}

/** NPS 국민연금 데이터 */
export interface NpsMetrics {
  totalCount: number;
  avgEmployeeCount: number;
  avgMonthlySalary: number;
  avgOperatingMonths: number;
}

/** 프랜차이즈 데이터 */
export interface FranchiseMetrics {
  franchiseCount: number;
  franchiseRatio: number;
  brandNames: string[];
}

/** 빌더에 전달되는 통합 데이터 */
export interface InsightData {
  competition: CompetitionAnalysis | null;
  nps: NpsMetrics | null;
  places: { totalCount: number; fetchedCount: number } | null;
  franchise: FranchiseMetrics | null;
  industryName: string;
  radius: number;
}

/** 각 룰 모듈이 export하는 함수 시그니처 */
export type InsightRule = (data: InsightData) => InsightItem[];
