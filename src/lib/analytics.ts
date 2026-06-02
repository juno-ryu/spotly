/**
 * GA4 커스텀 이벤트 트래킹 유틸
 *
 * window.gtag가 없는 환경(SSR, GA4 미설정)에서는 조용히 무시한다.
 */

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { gtag?: GtagFn }).gtag;
}

/** GA4 이벤트 이름 상수 */
export const AnalyticsEvent = {
  /** 분석 요청 — 주소 + 업종 입력 후 분석 시작 시 */
  ANALYSIS_REQUEST: "analysis_request",
  /** 리포트 조회 — 결과 페이지 진입 시 */
  REPORT_VIEW: "report_view",
  /** 리포트 공유 — 공유하기 버튼 클릭 시 */
  REPORT_SHARE: "report_share",
  /** 연관 업종 클릭 — 하단 CTA에서 연관 업종 분석 클릭 시 */
  RELATED_INDUSTRY_CLICK: "related_industry_click",
  /** 분석 입력 완료 — map-radius-step에서 분석 버튼 클릭 시 (로그인 여부 무관) */
  ANALYSIS_INPUT_SUBMITTED: "analysis_input_submitted",
  /** 비로그인 분석 요청 — 익명 유저가 quota 게이트 통과해 분석 실행 시 */
  ANALYSIS_REQUEST_ANONYMOUS: "analysis_request_anonymous",
  /** 비로그인 리포트 CTA 클릭 — 익명 결과 페이지에서 가입 유도 CTA 클릭 시 */
  REPORT_CTA_CLICK_ANONYMOUS: "report_cta_click_anonymous",
  /** 가입 완료 — OAuth 콜백 성공 직후 발화 */
  SIGNUP_COMPLETED: "signup_completed",
  /** 후기 제출 — 별점/결정 함께 전송 */
  REVIEW_SUBMIT: "review_submit",
  /** 후기 조회 — ReviewSummary 가 사용자 뷰포트에 처음 진입할 때 1회 */
  REVIEW_VIEW: "review_view",
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** 커스텀 이벤트 전송 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  getGtag()?.("event", eventName, params);
}

// ────────────────────────────────────────────────────────────
// UTM 파라미터 유틸
// ────────────────────────────────────────────────────────────

/** UTM 매체 유형 */
export type UtmMedium =
  | "kakao"
  | "clipboard"
  | "native_share"
  | "comment"
  | "description"
  | "post"
  | "bio"
  | "story"
  | "message";

/** UTM 파라미터 옵션 */
interface UtmParams {
  source?: string;
  medium: UtmMedium;
  campaign?: string;
  content?: string;
}

/** URL에 UTM 파라미터를 추가한다 */
export function appendUtm(baseUrl: string, params: UtmParams): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", params.source ?? "spotly");
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign ?? "report_share");
  if (params.content) url.searchParams.set("utm_content", params.content);
  return url.toString();
}