import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted로 안전하게 mock 함수 미리 선언
const mocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getOrCreateAnonymousIdMock: vi.fn(),
  isAnonymousQuotaUsedMock: vi.fn(),
}));

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: mocks.getUserMock },
  })),
}));

vi.mock("@/server/anonymous/cookie", () => ({
  getOrCreateAnonymousId: mocks.getOrCreateAnonymousIdMock,
  readAnonymousId: vi.fn(),
  clearAnonymousId: vi.fn(),
}));

vi.mock("@/server/anonymous/quota", () => ({
  isAnonymousQuotaUsed: mocks.isAnonymousQuotaUsedMock,
  markAnonymousQuotaUsed: vi.fn(),
}));

import { prepareAnalysisEntry } from "@/features/analysis/anonymous-actions";

beforeEach(() => {
  mocks.getUserMock.mockReset();
  mocks.getOrCreateAnonymousIdMock.mockReset();
  mocks.isAnonymousQuotaUsedMock.mockReset();
});

describe("prepareAnalysisEntry", () => {
  it("로그인 사용자는 쿠키 발급 없이 통과한다", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    const result = await prepareAnalysisEntry();

    expect(result).toEqual({ isAnonymous: false });
    expect(mocks.getOrCreateAnonymousIdMock).not.toHaveBeenCalled();
  });

  it("비로그인은 쿠키 발급 후 통과 (게이트 없음)", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });
    mocks.getOrCreateAnonymousIdMock.mockResolvedValue("anon-uuid-1");

    const result = await prepareAnalysisEntry();

    expect(result).toEqual({
      isAnonymous: true,
      anonymousId: "anon-uuid-1",
    });
    expect(mocks.getOrCreateAnonymousIdMock).toHaveBeenCalledOnce();
    expect(mocks.isAnonymousQuotaUsedMock).not.toHaveBeenCalled();
  });
});
