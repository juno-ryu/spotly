import { describe, it, expect } from "vitest";
import type { AnalysisReview } from "@prisma/client";
import { aggregateReviews } from "@/features/review/lib/aggregate";
import { Decision } from "@/features/review/schema";

/** 테스트용 row factory */
function makeRow(overrides: Partial<AnalysisReview> = {}): AnalysisReview {
  return {
    id: overrides.id ?? "rev_" + Math.random().toString(36).slice(2, 8),
    reportId: overrides.reportId ?? "rep_default",
    userId: overrides.userId ?? "user_default",
    rating: overrides.rating ?? 5,
    decision: overrides.decision ?? Decision.WILL_START,
    comment: overrides.comment ?? null,
    isPublic: overrides.isPublic ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-06-01T10:00:00Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-01T10:00:00Z"),
  } as AnalysisReview;
}

describe("aggregateReviews", () => {
  it("빈 배열은 평균 null + 결정 분포 0", () => {
    const result = aggregateReviews([], null);

    expect(result.total).toBe(0);
    expect(result.averageRating).toBeNull();
    expect(result.decisionCounts[Decision.WILL_START]).toBe(0);
    expect(result.decisionCounts[Decision.CONSIDERING]).toBe(0);
    expect(result.decisionCounts[Decision.WILL_NOT]).toBe(0);
    expect(result.decisionCounts[Decision.ALREADY_STARTED]).toBe(0);
    expect(result.publicComments).toEqual([]);
    expect(result.mine).toBeNull();
  });

  it("단일 공개 후기 — 평균/분포/공개 코멘트 모두 반영", () => {
    const rows = [
      makeRow({
        rating: 4,
        decision: Decision.CONSIDERING,
        comment: "괜찮은데 임대료가 걱정",
        isPublic: true,
      }),
    ];
    const result = aggregateReviews(rows, null);

    expect(result.total).toBe(1);
    expect(result.averageRating).toBe(4);
    expect(result.decisionCounts[Decision.CONSIDERING]).toBe(1);
    expect(result.publicComments).toHaveLength(1);
    expect(result.publicComments[0].comment).toBe("괜찮은데 임대료가 걱정");
  });

  it("평균 별점은 소수 첫째 자리까지 반올림", () => {
    const rows = [
      makeRow({ rating: 5 }),
      makeRow({ rating: 4 }),
      makeRow({ rating: 4 }),
    ];
    const result = aggregateReviews(rows, null);

    // (5+4+4)/3 = 4.333... → 4.3
    expect(result.averageRating).toBe(4.3);
  });

  it("isPublic=false 인 코멘트는 통계엔 포함, 코멘트는 제외", () => {
    const rows = [
      makeRow({
        id: "r1",
        rating: 3,
        decision: Decision.WILL_NOT,
        comment: "비공개 코멘트",
        isPublic: false,
      }),
    ];
    const result = aggregateReviews(rows, null);

    expect(result.total).toBe(1);
    expect(result.averageRating).toBe(3);
    expect(result.decisionCounts[Decision.WILL_NOT]).toBe(1);
    expect(result.publicComments).toHaveLength(0);
  });

  it("빈 코멘트(공백/null)는 publicComments 에 노출되지 않음", () => {
    const rows = [
      makeRow({ id: "r1", comment: "", isPublic: true }),
      makeRow({ id: "r2", comment: "   ", isPublic: true }),
      makeRow({ id: "r3", comment: null, isPublic: true }),
      makeRow({ id: "r4", comment: "유효한 한 줄", isPublic: true }),
    ];
    const result = aggregateReviews(rows, null);

    expect(result.publicComments).toHaveLength(1);
    expect(result.publicComments[0].id).toBe("r4");
  });

  it("publicComments 는 createdAt 내림차순 정렬 + 20개 컷오프", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      makeRow({
        id: `r${i}`,
        comment: `코멘트 ${i}`,
        isPublic: true,
        createdAt: new Date(2026, 0, i + 1), // 1월 1일부터 30일까지
      }),
    );
    const result = aggregateReviews(rows, null);

    expect(result.publicComments).toHaveLength(20);
    // 최신(i=29)이 첫 번째
    expect(result.publicComments[0].id).toBe("r29");
    // 20번째는 i=10
    expect(result.publicComments[19].id).toBe("r10");
  });

  it("currentUserId 가 일치하는 row 는 mine 으로 노출", () => {
    const rows = [
      makeRow({ id: "r1", userId: "user_other", rating: 2 }),
      makeRow({ id: "r2", userId: "user_me", rating: 5 }),
    ];
    const result = aggregateReviews(rows, "user_me");

    expect(result.mine).not.toBeNull();
    expect(result.mine?.id).toBe("r2");
    expect(result.mine?.rating).toBe(5);
  });

  it("currentUserId 가 null 이면 mine 도 null", () => {
    const rows = [makeRow({ userId: "user_x" })];
    const result = aggregateReviews(rows, null);
    expect(result.mine).toBeNull();
  });

  it("알 수 없는 decision 값(레거시/오염)은 분포에서 무시", () => {
    const rows = [
      makeRow({ decision: Decision.WILL_START }),
      makeRow({ decision: "UNKNOWN_LEGACY" }), // 레거시/오염 — schema는 String이므로 타입은 통과
    ];
    const result = aggregateReviews(rows, null);

    expect(result.total).toBe(2); // 평균 통계엔 포함
    expect(result.decisionCounts[Decision.WILL_START]).toBe(1);
    // 4개 합이 1 (UNKNOWN 은 카운트 안 됨)
    const sum = Object.values(result.decisionCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1);
  });
});
