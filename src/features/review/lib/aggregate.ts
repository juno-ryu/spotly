import type { AnalysisReview } from "@prisma/client";
import { Decision, type ReviewSummary } from "@/features/review/schema";

/** 공개 코멘트 노출 한도 — 향후 페이지네이션 도입 전 1차 컷오프 */
const PUBLIC_COMMENTS_LIMIT = 20;

/**
 * 후기 row 배열을 ReviewSummary 로 집계한다.
 *
 * - 평균 별점/결정 분포는 모든 후기(공개 여부 무관)로 계산
 * - publicComments 는 isPublic=true && comment 비어있지 않은 것, 최신순 최대 20개
 * - mine 은 currentUserId 가 있을 때만 채워짐 (Server Component → 클라이언트로 전달용)
 */
export function aggregateReviews(
  rows: AnalysisReview[],
  currentUserId: string | null,
): ReviewSummary {
  const total = rows.length;
  const averageRating =
    total === 0
      ? null
      : Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / total) * 10) /
        10;

  const decisionCounts: ReviewSummary["decisionCounts"] = {
    [Decision.WILL_START]: 0,
    [Decision.CONSIDERING]: 0,
    [Decision.WILL_NOT]: 0,
    [Decision.ALREADY_STARTED]: 0,
  };
  for (const r of rows) {
    if (isDecision(r.decision)) decisionCounts[r.decision] += 1;
  }

  const publicComments = rows
    .filter(
      (r) =>
        r.isPublic &&
        r.comment &&
        r.comment.trim().length > 0 &&
        isDecision(r.decision),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, PUBLIC_COMMENTS_LIMIT)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      decision: r.decision as Decision, // filter 에서 isDecision 으로 가드됨
      comment: r.comment as string, // filter 에서 빈/null 제외됨
      authorName: r.authorName,
      createdAt: r.createdAt.toISOString(),
    }));

  const mineRow = currentUserId
    ? (rows.find((r) => r.userId === currentUserId) ?? null)
    : null;
  // mine 의 decision 이 알 수 없는 값이면 본인 후기로 노출하지 않는다 (정합성 깨진 row 무시)
  const mine =
    mineRow && isDecision(mineRow.decision)
      ? {
          id: mineRow.id,
          rating: mineRow.rating,
          decision: mineRow.decision,
          comment: mineRow.comment,
          authorName: mineRow.authorName,
          isPublic: mineRow.isPublic,
          createdAt: mineRow.createdAt.toISOString(),
        }
      : null;

  return { total, averageRating, decisionCounts, publicComments, mine };
}

function isDecision(value: string): value is Decision {
  return value in {
    [Decision.WILL_START]: 1,
    [Decision.CONSIDERING]: 1,
    [Decision.WILL_NOT]: 1,
    [Decision.ALREADY_STARTED]: 1,
  };
}
