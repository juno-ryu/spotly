/** 분석 기본 반경 (미터) */
export const ANALYSIS_RADIUS_DEFAULT = 500;

/**
 * 학교 접근성 분석 반경 — 레벨별 (미터)
 *
 * 초등학교는 도보 안전 거리 기준, 중·고등학교는 통학 가능 거리 기준으로
 * 레벨에 따라 반경을 달리 적용하여 실제 영향도를 반영한다.
 */
export const SCHOOL_RADIUS = {
  /** 초등학교: 도보 안전 통학 거리 */
  ELEMENTARY: 500,
  /** 중학교: 실제 통학 반경 */
  MIDDLE: 1_000,
  /** 고등학교: 실제 통학 반경 */
  HIGH: 1_500,
} as const;

/** 대학교 탐색 반경 (미터) */
export const UNIVERSITY_RADIUS = 2_000;

/** 의료시설 탐색 반경 (미터) */
export const MEDICAL_RADIUS = 2_000;
