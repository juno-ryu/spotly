/**
 * AI 리포트 생성 진행 표시용 단계 라벨.
 *
 * production: `GeneratingProgress` 가 setInterval 로 순차 활성화.
 * preview: 메인 인트로 fold 7 에서 CSS @keyframes 로 순환 애니메이션.
 */
export const GENERATION_STEPS = [
  "국민연금공단(NPS) 사업체 데이터 분석",
  "서울시(골목상권) 매출·유동인구 분석",
  "통계청(KOSIS) 전국 배후인구 데이터 분석",
  "국토교통부(TAGO) 전국 버스·지하철 교통 분석",
  "Kakao Places(카카오) 인접 매장 분석",
  "교육부·카카오 학교·대학·의료 인프라 분석",
  "데이터 취합 및 AI 리포트 작성중입니다.",
] as const;
