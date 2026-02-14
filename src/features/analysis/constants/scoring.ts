/** 스코어링 가중치 (합계 100) */
export const SCORING_WEIGHTS = {
  /** 상권 활력도 (30점) */
  VITALITY: 30,
  /** 경쟁 강도 (25점, 역비례) */
  COMPETITION: 25,
  /** 생존율 (20점) */
  SURVIVAL: 20,
  /** 주거 밀도 (15점) */
  RESIDENTIAL: 15,
  /** 소득 수준 (10점) */
  INCOME: 10,
} as const;

/** 상권 활력도: 복합 지표 기준 */
export const VITALITY_THRESHOLDS = {
  /** 신규 창업 비율 가중치 (2년 이내 가입일 비율) */
  NEW_BIZ_WEIGHT: 0.3,
  /** 평균 직원 규모 가중치 */
  AVG_EMPLOYEE_WEIGHT: 0.4,
  /** 활성 비율 가중치 */
  ACTIVE_RATIO_WEIGHT: 0.3,
  /** 평균 직원수 기준 (이 이상이면 해당 항목 만점) */
  MAX_AVG_EMPLOYEES: 20,
  /** 신규 창업 판단 기간 (개월) */
  NEW_BIZ_MONTHS: 24,
} as const;

/** 경쟁 강도: 업종별 기준 밀도 (개/km²) */
export const COMPETITION_BASE_DENSITY: Record<string, number> = {
  default: 10,
  I56192: 8,  // 치킨전문점
  I56111: 12, // 한식음식점
  I56191: 15, // 커피전문점
  I56194: 10, // 분식전문점
  G47112: 5,  // 편의점
  S96112: 8,  // 미용실
};

/** 생존율 기준 */
export const SURVIVAL_THRESHOLDS = {
  /** 이 이상이면 만점 */
  MAX_RATE: 0.9,
  /** 이 이하면 0점 */
  MIN_RATE: 0.5,
} as const;

/** 전국 평균 아파트 거래가 (만원, 2025년 기준) */
export const NATIONAL_AVG_APT_PRICE = 45000;

/** 주거 밀도: 아파트 거래 건수 기준 (연간) */
export const RESIDENTIAL_THRESHOLDS = {
  /** 이 이상이면 만점 */
  MAX_TRANSACTIONS: 200,
  /** 이 이하면 0점 */
  MIN_TRANSACTIONS: 10,
} as const;
