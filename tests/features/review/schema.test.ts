import { describe, it, expect } from "vitest";
import { submitReviewSchema, Decision } from "@/features/review/schema";

const valid = {
  reportId: "rep_123",
  rating: 4,
  decision: Decision.WILL_START,
  comment: "좋은 자리",
  isPublic: true,
};

describe("submitReviewSchema", () => {
  it("유효한 입력은 통과", () => {
    expect(submitReviewSchema.safeParse(valid).success).toBe(true);
  });

  it("rating=0 은 거절 (별점 미선택)", () => {
    const result = submitReviewSchema.safeParse({ ...valid, rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rating=6 은 거절 (범위 초과)", () => {
    const result = submitReviewSchema.safeParse({ ...valid, rating: 6 });
    expect(result.success).toBe(false);
  });

  it("rating=3.5 은 거절 (정수만)", () => {
    const result = submitReviewSchema.safeParse({ ...valid, rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("decision 미지정은 거절", () => {
    const { decision: _decision, ...rest } = valid;
    void _decision;
    const result = submitReviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("decision 알 수 없는 값은 거절", () => {
    const result = submitReviewSchema.safeParse({
      ...valid,
      decision: "MAYBE",
    });
    expect(result.success).toBe(false);
  });

  it("comment 501자는 거절", () => {
    const result = submitReviewSchema.safeParse({
      ...valid,
      comment: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("comment 500자는 통과", () => {
    const result = submitReviewSchema.safeParse({
      ...valid,
      comment: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("comment 생략 가능", () => {
    const { comment: _comment, ...rest } = valid;
    void _comment;
    const result = submitReviewSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("reportId 빈 문자열 거절", () => {
    const result = submitReviewSchema.safeParse({ ...valid, reportId: "" });
    expect(result.success).toBe(false);
  });

  it("isPublic 누락 거절", () => {
    const { isPublic: _isPublic, ...rest } = valid;
    void _isPublic;
    const result = submitReviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("comment 의 앞뒤 공백은 trim", () => {
    const result = submitReviewSchema.safeParse({
      ...valid,
      comment: "  여백 있는 코멘트  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe("여백 있는 코멘트");
    }
  });
});
