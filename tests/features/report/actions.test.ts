import { describe, it, expect, vi, beforeEach } from "vitest";

// generateReport는 외부 API(Anthropic), DB, Supabase를 모두 사용하므로
// quota 게이트 분기(Claude 호출 *전*)에 집중해서 테스트한다.

const mocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getOrCreateAnonymousIdMock: vi.fn(),
  isAnonymousQuotaUsedMock: vi.fn(),
  markAnonymousQuotaUsedMock: vi.fn(),
  createReportMock: vi.fn(),
  hasApiKeyAnthropicMock: vi.fn(() => true),
  anthropicCreateMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  get hasApiKey() {
    return { anthropic: mocks.hasApiKeyAnthropicMock() };
  },
}));

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: mocks.getUserMock },
  })),
}));

vi.mock("@/server/anonymous/cookie", () => ({
  getOrCreateAnonymousId: mocks.getOrCreateAnonymousIdMock,
}));

vi.mock("@/server/anonymous/quota", () => ({
  isAnonymousQuotaUsed: mocks.isAnonymousQuotaUsedMock,
  markAnonymousQuotaUsed: mocks.markAnonymousQuotaUsedMock,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    analysisReport: {
      create: mocks.createReportMock,
    },
  },
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: mocks.anthropicCreateMock,
      };
    },
  };
});

// AI 리포트 스키마 검증을 통과하는 최소 JSON
const VALID_AI_REPORT_JSON = JSON.stringify({
  verdict: "위험",
  summary: "테스트 요약입니다.",
  competitorInsight: "테스트",
  populationInsight: { headline: "테스트", body: "테스트" },
  revenueEstimate: { monthlyPerStoreMaan: 100, basis: "테스트" },
  survivalAnalysis: { closeRate: 5, openRate: 5, basis: "테스트" },
  competitorCount: { direct: 10, franchise: 2 },
  riskWarnings: [{ title: "테스트", body: "테스트" }],
  strategy: ["테스트"],
  alternativeLocations: ["테스트"],
  targetCustomers: ["테스트"],
  recommendedHours: "테스트",
  nearbyInfra: "테스트",
  analysisScope: "테스트",
});

import { generateReport } from "@/features/report/actions";

const sampleAnalysisData = {
  address: "주소",
  industryName: "카페",
  industryKeyword: "카페",
  radius: 300,
  totalScore: 70,
  scoreDetail: undefined,
  isSeoul: true,
  centerLatitude: 37.5,
  centerLongitude: 127.0,
  competition: { competitionScore: 50 },
  vitality: null,
  populationAnalysis: null,
  subway: null,
  bus: null,
  school: null,
  university: null,
  medical: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

beforeEach(() => {
  mocks.getUserMock.mockReset();
  mocks.getOrCreateAnonymousIdMock.mockReset();
  mocks.isAnonymousQuotaUsedMock.mockReset();
  mocks.markAnonymousQuotaUsedMock.mockReset();
  mocks.createReportMock.mockReset();
  mocks.anthropicCreateMock.mockReset();
  mocks.hasApiKeyAnthropicMock.mockReturnValue(true);
});

describe("generateReport — anonymous quota 게이트", () => {
  it("비로그인 + quota 이미 사용 → ANONYMOUS_QUOTA_EXHAUSTED + Claude 호출 안 함", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });
    mocks.getOrCreateAnonymousIdMock.mockResolvedValue("anon-1");
    mocks.isAnonymousQuotaUsedMock.mockResolvedValue(true);

    const result = await generateReport(sampleAnalysisData);

    expect(result.success).toBe(false);
    if (!result.success && "reason" in result) {
      expect(result.reason).toBe("anonymous_quota_exhausted");
    }
    expect(mocks.anthropicCreateMock).not.toHaveBeenCalled();
  });

  it("비로그인 + quota 미사용 → 쿠키 발급 + quota 체크 후 Claude 단계 진입", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });
    mocks.getOrCreateAnonymousIdMock.mockResolvedValue("anon-fresh");
    mocks.isAnonymousQuotaUsedMock.mockResolvedValue(false);
    mocks.anthropicCreateMock.mockRejectedValue(new Error("not under test"));

    await generateReport(sampleAnalysisData).catch(() => {});

    expect(mocks.getOrCreateAnonymousIdMock).toHaveBeenCalledOnce();
    expect(mocks.isAnonymousQuotaUsedMock).toHaveBeenCalledWith("anon-fresh");
    // 게이트 통과 → 결과는 success: false가 아닌 quota_exhausted여야 함
    const result = await generateReport(sampleAnalysisData).catch(() => null);
    expect(result === null || (result && "reason" in result && result.reason !== "anonymous_quota_exhausted"))
      .toBe(true);
  });

  it("로그인 사용자 → quota·익명 함수 어느 것도 호출되지 않음", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user-xyz" } },
    });
    // Anthropic은 본 테스트에서 호출되지 않거나, 호출돼도 quota 함수 미호출이 핵심
    mocks.anthropicCreateMock.mockRejectedValue(new Error("not under test"));

    await generateReport(sampleAnalysisData).catch(() => {});

    expect(mocks.getOrCreateAnonymousIdMock).not.toHaveBeenCalled();
    expect(mocks.isAnonymousQuotaUsedMock).not.toHaveBeenCalled();
    expect(mocks.markAnonymousQuotaUsedMock).not.toHaveBeenCalled();
  });

  it("Anthropic API 키 미설정 → 기존 동작 유지 (quota 체크 전)", async () => {
    mocks.hasApiKeyAnthropicMock.mockReturnValue(false);

    const result = await generateReport(sampleAnalysisData);

    expect(result.success).toBe(false);
    expect(mocks.getUserMock).not.toHaveBeenCalled();
  });
});
