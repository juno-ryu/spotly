import { describe, it, expect, vi, beforeEach } from "vitest";

// submitReview 의 권한·검증 분기 회귀 테스트.
// Codex high finding 대응: 타인 reportId 로 후기 도배 차단을 보장한다.

const mocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  findReportMock: vi.fn(),
  createReviewMock: vi.fn(),
  findManyReviewMock: vi.fn(() => Promise.resolve([])),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: mocks.getUserMock },
  })),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    analysisReport: {
      findUnique: mocks.findReportMock,
    },
    analysisReview: {
      create: mocks.createReviewMock,
      findMany: mocks.findManyReviewMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePathMock,
}));

import { submitReview } from "@/features/review/actions";
import { Decision } from "@/features/review/schema";

const VALID_INPUT = {
  reportId: "rep_owner",
  rating: 5,
  decision: Decision.WILL_START,
  comment: "좋은 자리",
  isPublic: true,
} as const;

beforeEach(() => {
  mocks.getUserMock.mockReset();
  mocks.findReportMock.mockReset();
  mocks.createReviewMock.mockReset();
  mocks.findManyReviewMock.mockReset();
  mocks.findManyReviewMock.mockResolvedValue([]);
  mocks.revalidatePathMock.mockReset();
});

describe("submitReview — 인증/권한", () => {
  it("비로그인 요청은 거절", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await submitReview({ ...VALID_INPUT });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/가입자만/);
    expect(mocks.createReviewMock).not.toHaveBeenCalled();
  });

  it("존재하지 않는 reportId 는 거절", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue(null);

    const result = await submitReview({ ...VALID_INPUT });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/찾을 수 없어요/);
    expect(mocks.createReviewMock).not.toHaveBeenCalled();
  });

  it("타인이 만든 리포트는 거절 (도배 차단)", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue({
      id: "rep_other",
      userId: "user_someone_else",
    });

    const result = await submitReview({
      ...VALID_INPUT,
      reportId: "rep_other",
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toMatch(/본인이 생성한 리포트에만/);
    expect(mocks.createReviewMock).not.toHaveBeenCalled();
  });

  it("userId 가 null 인 레거시 리포트(익명 생성)는 거절", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue({
      id: "rep_legacy",
      userId: null,
    });

    const result = await submitReview({
      ...VALID_INPUT,
      reportId: "rep_legacy",
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toMatch(/본인이 생성한 리포트에만/);
    expect(mocks.createReviewMock).not.toHaveBeenCalled();
  });

  it("본인 리포트면 저장 성공 + revalidatePath 호출", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue({
      id: "rep_owner",
      userId: "user_me",
    });
    mocks.createReviewMock.mockResolvedValue(undefined);

    const result = await submitReview({ ...VALID_INPUT });

    expect(result.success).toBe(true);
    expect(mocks.createReviewMock).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePathMock).toHaveBeenCalledWith("/report/rep_owner");
  });

  it("Prisma P2002(중복) 은 친절한 에러 메시지로 매핑", async () => {
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue({
      id: "rep_owner",
      userId: "user_me",
    });
    mocks.createReviewMock.mockRejectedValue({ code: "P2002" });

    const result = await submitReview({ ...VALID_INPUT });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/이미 이 리포트에/);
  });
});

describe("submitReview — 입력 검증", () => {
  beforeEach(() => {
    // 인증/리포트는 통과시키고 입력 검증만 본다
    mocks.getUserMock.mockResolvedValue({
      data: { user: { id: "user_me" } },
    });
    mocks.findReportMock.mockResolvedValue({
      id: "rep_owner",
      userId: "user_me",
    });
  });

  it("rating=0 거절 (zod 분기)", async () => {
    const result = await submitReview({ ...VALID_INPUT, rating: 0 });
    expect(result.success).toBe(false);
    expect(mocks.findReportMock).not.toHaveBeenCalled(); // schema에서 컷
  });
});
