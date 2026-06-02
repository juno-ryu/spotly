import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsEvent, trackEvent } from "@/lib/analytics";

describe("AnalyticsEvent — 익명 funnel 이벤트", () => {
  it("ANALYSIS_INPUT_SUBMITTED 정의됨", () => {
    expect(AnalyticsEvent.ANALYSIS_INPUT_SUBMITTED).toBe("analysis_input_submitted");
  });

  it("ANALYSIS_REQUEST_ANONYMOUS 정의됨", () => {
    expect(AnalyticsEvent.ANALYSIS_REQUEST_ANONYMOUS).toBe("analysis_request_anonymous");
  });

  it("REPORT_CTA_CLICK_ANONYMOUS 정의됨", () => {
    expect(AnalyticsEvent.REPORT_CTA_CLICK_ANONYMOUS).toBe("report_cta_click_anonymous");
  });

  it("SIGNUP_COMPLETED 정의됨", () => {
    expect(AnalyticsEvent.SIGNUP_COMPLETED).toBe("signup_completed");
  });
});

describe("trackEvent", () => {
  beforeEach(() => {
    // window.gtag 초기화
    // @ts-expect-error - test stub
    globalThis.window = { gtag: vi.fn() };
  });

  it("window.gtag 호출 — 이벤트명과 파라미터 전달", () => {
    trackEvent(AnalyticsEvent.ANALYSIS_REQUEST_ANONYMOUS, { industry: "카페" });

    // @ts-expect-error - test stub
    const gtag = globalThis.window.gtag as ReturnType<typeof vi.fn>;
    expect(gtag).toHaveBeenCalledWith("event", "analysis_request_anonymous", {
      industry: "카페",
    });
  });

  it("gtag 미설정 환경에서는 조용히 무시", () => {
    // @ts-expect-error - test stub
    globalThis.window = {};
    expect(() =>
      trackEvent(AnalyticsEvent.SIGNUP_COMPLETED),
    ).not.toThrow();
  });
});
