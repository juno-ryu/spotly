import { signInWithKakao } from "@/features/auth/actions";
import { KakaoIcon } from "@/components/icons/kakao-icon";
import { getReviewSummary } from "@/features/review/actions";
import { ReviewSummary } from "./review-summary";
import { ReviewForm } from "./review-form";
import { ReviewViewTracker } from "./review-view-tracker";

interface ReviewSectionProps {
  reportId: string;
  reportOwnerId: string | null;
  currentUserId: string | null;
  returnTo: string;
}

/**
 * 리포트 페이지 하단 후기 섹션.
 *
 * 4가지 상태 분기:
 *  - 비로그인 → 요약 + 카카오 로그인 카드
 *  - 로그인했지만 본인 리포트 아님 → 요약 + "본인이 생성한 리포트에만 ..." 안내
 *  - 본인 리포트 + 후기 미작성 → 요약 + ReviewForm
 *  - 본인 리포트 + 후기 작성됨 → 요약 + "이미 작성하셨어요" 안내
 *
 * Supabase getUser() 와 prisma.analysisReport.findUnique() 는 페이지 컴포넌트가
 * 이미 호출했으므로 그 값을 props 로 받아 중복 round-trip 을 피한다.
 */
export async function ReviewSection({
  reportId,
  reportOwnerId,
  currentUserId,
  returnTo,
}: ReviewSectionProps) {
  // getReviewSummary 는 내부에서 supabase.auth.getUser() 로 본인 후기를 식별한다.
  // (currentUserId 를 인자로 넘기지 않는 이유는 actions.ts 의 주석 참조)
  const summary = await getReviewSummary(reportId);

  const isLoggedIn = !!currentUserId;
  const isOwner =
    isLoggedIn && !!reportOwnerId && reportOwnerId === currentUserId;

  return (
    <section
      id="review-section"
      className="px-6 mt-8 space-y-4 scroll-mt-20"
      aria-labelledby="review-section-heading"
    >
      <h2 id="review-section-heading" className="text-base font-bold">
        이 리포트에 대한 후기
      </h2>

      <ReviewSummary summary={summary} />

      {!isLoggedIn && <LoginPromptCard returnTo={returnTo} />}

      {isLoggedIn && !isOwner && (
        <p className="text-xs text-muted-foreground">
          본인이 생성한 리포트에만 후기를 남길 수 있어요.
        </p>
      )}

      {isLoggedIn && isOwner && summary.mine && (
        <p className="text-xs text-muted-foreground">
          이미 이 리포트에 후기를 남기셨어요. (수정 기능은 곧 추가될 예정)
        </p>
      )}

      {isLoggedIn && isOwner && !summary.mine && (
        <ReviewForm reportId={reportId} />
      )}

      <ReviewViewTracker reportId={reportId} total={summary.total} />
    </section>
  );
}

/** 비로그인 사용자에게 카카오 로그인 + returnTo 유도. anonymous-cta-banner 패턴 동일 */
function LoginPromptCard({ returnTo }: { returnTo: string }) {
  return (
    <form action={signInWithKakao} className="w-full">
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="w-full flex items-center justify-between gap-2 rounded-lg bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#3C1E1E] shadow-sm hover:bg-[#F5DC00] active:scale-[0.98] transition-all"
      >
        <span className="flex items-center gap-2 break-keep">
          <KakaoIcon />
          후기 작성은 가입자만 가능해요. 카카오로 시작하기
        </span>
        <span className="text-base leading-none">→</span>
      </button>
    </form>
  );
}
