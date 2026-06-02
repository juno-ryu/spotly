"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { createSupabaseServer } from "@/server/supabase/server";
import {
  submitReviewSchema,
  type SubmitReviewInput,
  type ReviewSummary,
} from "./schema";
import { aggregateReviews } from "./lib/aggregate";

type SubmitResult =
  | { success: true; data: ReviewSummary }
  | { success: false; error: string };

/**
 * 후기 제출 — 본인이 생성한 리포트에 한해 1회 등록.
 *
 * 권한 검증: AnalysisReport.userId === currentUserId.
 * 공유 URL 로 들어온 타 사용자가 별점/코멘트를 도배해 평균·분포를 오염시키는 것을 막는다.
 */
export async function submitReview(
  raw: SubmitReviewInput,
): Promise<SubmitResult> {
  const parsed = submitReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "입력값이 올바르지 않아요. 다시 확인해주세요.",
    };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "후기 작성은 가입자만 가능해요." };
  }

  const report = await prisma.analysisReport.findUnique({
    where: { id: input.reportId },
    select: { id: true, userId: true },
  });
  if (!report) {
    return { success: false, error: "리포트를 찾을 수 없어요." };
  }
  if (!report.userId || report.userId !== user.id) {
    return {
      success: false,
      error: "본인이 생성한 리포트에만 후기를 남길 수 있어요.",
    };
  }

  // 작성 시점 닉네임 스냅샷 — user_metadata.full_name (카카오 OAuth)
  const rawName = user.user_metadata?.full_name;
  const authorName =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim()
      : null;

  try {
    await prisma.analysisReview.create({
      data: {
        reportId: input.reportId,
        userId: user.id,
        authorName,
        rating: input.rating,
        decision: input.decision,
        comment: input.comment?.trim() ? input.comment.trim() : null,
        isPublic: input.isPublic,
      },
    });
  } catch (error) {
    // Prisma 에러 코드 안전 추출 — `error: unknown` 에서 `code` 좁히기
    const code =
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    // P2002 = unique constraint 위반 — 같은 (reportId, userId) 중복 제출
    if (code === "P2002") {
      return { success: false, error: "이미 이 리포트에 후기를 남기셨어요." };
    }
    console.error("후기 저장 실패:", error);
    return { success: false, error: "후기 저장 중 오류가 발생했어요." };
  }

  // findMany 를 먼저 끝낸 뒤에 revalidatePath — 호출 측이 반환 data 를 신뢰할 수 있도록
  const rows = await prisma.analysisReview.findMany({
    where: { reportId: input.reportId },
  });
  revalidatePath(`/report/${input.reportId}`);
  return { success: true, data: aggregateReviews(rows, user.id) };
}

/**
 * Server Component 용 — 리포트 페이지 SSR 에서 요약 조회.
 *
 * currentUserId 를 외부 인자로 받지 않고 함수 내부에서 supabase.auth.getUser() 로 다시 확인한다.
 * (Server Action 으로 노출되므로 클라이언트가 임의의 userId 를 넘겨 타인의 `mine` 을
 *  엿보는 것을 차단)
 */
export async function getReviewSummary(
  reportId: string,
): Promise<ReviewSummary> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rows = await prisma.analysisReview.findMany({
    where: { reportId },
  });
  return aggregateReviews(rows, user?.id ?? null);
}
