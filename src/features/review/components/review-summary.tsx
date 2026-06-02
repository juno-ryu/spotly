import { Star } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/ko";
import {
  Decision,
  DECISION_LABEL,
  DECISION_ORDER,
  type ReviewSummary as ReviewSummaryType,
} from "@/features/review/schema";
import { cn } from "@/lib/utils";

// 글로벌 1회 setup — 모듈 import 시점에 등록되며 멱등.
dayjs.extend(relativeTime);
dayjs.locale("ko");

interface ReviewSummaryProps {
  summary: ReviewSummaryType;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  if (summary.total === 0) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        아직 등록된 후기가 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      {/* 평균 별점 + 총 응답 수 */}
      <div className="flex items-baseline gap-2">
        <Star className="h-5 w-5 fill-violet-500 stroke-violet-600" />
        <span className="text-2xl font-bold leading-none">
          {summary.averageRating?.toFixed(1) ?? "—"}
        </span>
        <span className="text-sm text-muted-foreground">/ 5</span>
        <span className="text-xs text-muted-foreground ml-1">
          · {summary.total}명 응답
        </span>
      </div>

      {/* 결정 분포 — 가로 막대 */}
      <div className="space-y-1.5">
        {DECISION_ORDER.map((d) => {
          const count = summary.decisionCounts[d] ?? 0;
          const ratio = summary.total === 0 ? 0 : count / summary.total;
          const pct = Math.round(ratio * 100);
          return (
            <div key={d} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground break-keep">
                {DECISION_LABEL[d]}
              </span>
              <div className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    d === Decision.WILL_START
                      ? "bg-emerald-500"
                      : d === Decision.CONSIDERING
                        ? "bg-blue-500"
                        : d === Decision.WILL_NOT
                          ? "bg-orange-500"
                          : "bg-violet-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* 공개 코멘트 리스트 */}
      {summary.publicComments.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          {summary.publicComments.map((c) => (
            <div
              key={c.id}
              className="border-l-2 border-violet-600 dark:border-violet-500 pl-3 py-1"
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-violet-500 stroke-violet-600" />
                <span>{c.rating}.0</span>
                <span aria-hidden>·</span>
                <span>{DECISION_LABEL[c.decision]}</span>
                <span aria-hidden>·</span>
                <span className="font-medium text-foreground/80">
                  {c.authorName ?? "익명"}
                </span>
                <span aria-hidden>·</span>
                <time dateTime={c.createdAt}>
                  {dayjs(c.createdAt).fromNow()}
                </time>
              </div>
              <p className="mt-1 text-sm text-foreground/90 break-keep whitespace-pre-wrap">
                {c.comment}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
