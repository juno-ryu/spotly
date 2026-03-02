/** 분석 기본 반경 (미터) */
export const ANALYSIS_RADIUS_DEFAULT = 500;

/** 의료시설 Kakao 탐색 반경 (미터) — 사용자 선택 반경과 무관하게 고정
 * 종합병원/의료원은 넓게 분포하므로 3000m로 고정 탐색 */
export const MEDICAL_SEARCH_RADIUS = 3000;

/** 대학교 Kakao 탐색 반경 (미터) — 사용자 선택 반경과 무관하게 고정
 * 캠퍼스가 블록 단위로 넓게 분포하므로 2000m로 고정 탐색 */
export const UNIVERSITY_SEARCH_RADIUS = 2000;
