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

/** 커스텀 이벤트 전송 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  getGtag()?.("event", eventName, params);
}

/** 분석 요청 이벤트 — 주소 + 업종 입력 후 분석 시작 시 */
export function trackAnalysis(address: string, businessType: string) {
  trackEvent("analysis_request", {
    address,
    business_type: businessType,
  });
}

/** 리포트 조회 이벤트 — 결과 페이지 진입 시 */
export function trackReportView(analysisId: string) {
  trackEvent("report_view", { analysis_id: analysisId });
}
