/**
 * 경쟁 강도 점수 (0~100, 높을수록 경쟁 약함 = 창업에 유리)
 *
 * 복합 지표: 밀집도(75%) + 프랜차이즈 U커브(25%)
 */
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
