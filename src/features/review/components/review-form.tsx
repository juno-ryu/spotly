"use client";

import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";
import {
  submitReviewSchema,
  type SubmitReviewInput,
  Decision,
  DECISION_LABEL,
  DECISION_ORDER,
} from "@/features/review/schema";
import { submitReview } from "@/features/review/actions";

interface ReviewFormProps {
  reportId: string;
}

const COMMENT_MAX_LENGTH = 500;

export function ReviewForm({ reportId }: ReviewFormProps) {
  const [isSubmitting, startTransition] = useTransition();
  const form = useForm<SubmitReviewInput>({
    resolver: zodResolver(submitReviewSchema),
    defaultValues: {
      reportId,
      rating: 0,
      decision: undefined,
      comment: "",
      isPublic: true,
    },
  });

  const decisionValue = form.watch("decision");
  const ratingValue = form.watch("rating");
  const commentValue = form.watch("comment") ?? "";
  // 결정 토글을 누른 뒤에 별점 입력을 활성화 — 마찰 ↓
  const ratingEnabled = !!decisionValue;

  const onSubmit = (data: SubmitReviewInput) => {
    startTransition(async () => {
      const res = await submitReview(data);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      trackEvent(AnalyticsEvent.REVIEW_SUBMIT, {
        rating: data.rating,
        decision: data.decision,
        has_comment: !!data.comment,
        is_public: data.isPublic,
      });
      toast.success("후기가 등록되었어요");
      // Server Action 의 revalidatePath 가 리포트 페이지를 재검증한다 →
      // 다음 렌더에서 ReviewSection 이 mine 채워진 summary 를 받아 폼이 안내문구로 교체됨
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border bg-card p-4"
      aria-labelledby="review-form-heading"
    >
      <h3 id="review-form-heading" className="text-sm font-bold">
        나의 후기 남기기
      </h3>

      {/* 1) 결정 토글 — 2x2 grid (모바일 우선) */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          어떻게 결정하셨나요?
        </Label>
        <Controller
          control={form.control}
          name="decision"
          render={({ field, fieldState }) => (
            <>
              <div className="grid grid-cols-2 gap-2">
                {DECISION_ORDER.map((value) => {
                  const selected = field.value === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={cn(
                        "h-11 rounded-lg border text-sm font-medium transition-colors break-keep",
                        selected
                          ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                          : "border-input bg-background text-foreground hover:bg-muted",
                      )}
                      aria-pressed={selected}
                    >
                      {DECISION_LABEL[value]}
                    </button>
                  );
                })}
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive">결정을 선택해주세요</p>
              )}
            </>
          )}
        />
      </div>

      {/* 2) 별점 — 결정 토글 후 활성화 */}
      <div className="space-y-2">
        <Label
          className={cn(
            "text-xs",
            ratingEnabled ? "text-muted-foreground" : "text-muted-foreground/50",
          )}
        >
          별점을 선택해주세요
        </Label>
        <Controller
          control={form.control}
          name="rating"
          render={({ field, fieldState }) => (
            <>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="별점">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = field.value >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={!ratingEnabled}
                      onClick={() => field.onChange(star)}
                      className={cn(
                        "h-11 w-11 grid place-items-center rounded-md transition-colors",
                        ratingEnabled
                          ? "hover:bg-muted cursor-pointer"
                          : "cursor-not-allowed opacity-50",
                      )}
                      aria-label={`${star}점`}
                      role="radio"
                      aria-checked={field.value === star}
                    >
                      <Star
                        className={cn(
                          "h-7 w-7 transition-colors",
                          active
                            ? "fill-violet-500 stroke-violet-600"
                            : "fill-none stroke-muted-foreground/60",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive">별점을 선택해주세요</p>
              )}
            </>
          )}
        />
      </div>

      {/* 3) 코멘트 (선택) — 다른 사장님들께 도움이 되는 한 마디 */}
      <div className="space-y-2">
        <Label htmlFor="review-comment" className="text-xs text-muted-foreground leading-snug break-keep">
          남겨주신 후기는 이후 이 리포트를 보게 되시는 사장님들께 큰 도움이 돼요.
        </Label>
        <textarea
          id="review-comment"
          placeholder="이 자리에 대한 솔직한 후기를 들려주세요"
          maxLength={COMMENT_MAX_LENGTH}
          rows={4}
          className={cn(
            "placeholder:text-muted-foreground border-input bg-transparent dark:bg-input/30",
            "w-full min-w-0 rounded-md border px-3 py-2 text-sm shadow-xs",
            "outline-none transition-[color,box-shadow] resize-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          )}
          {...form.register("comment")}
        />
        <p className="text-[10px] text-muted-foreground/70 text-right">
          {commentValue.length} / {COMMENT_MAX_LENGTH}
        </p>
      </div>

      {/* 후기는 항상 익명으로 다른 사용자에게 공개됨 — defaultValues 의 isPublic: true 그대로 사용 */}

      <Button
        type="submit"
        disabled={isSubmitting || !decisionValue || ratingValue === 0}
        className="w-full h-11"
      >
        {isSubmitting ? "등록 중..." : "후기 남기기"}
      </Button>
    </form>
  );
}
