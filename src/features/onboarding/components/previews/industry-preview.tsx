import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { ONBOARDING_INDUSTRIES } from "../../constants/industries";

interface IndustryPreviewProps {
  /** preview 카드에서 강조할 업종명 */
  selectedIndustryName: string;
}

const HEADER_TEXT = "어떤 창업 생각 중이세요?";

/**
 * Fold 3 — IndustrySelector 시각 재현.
 * 사이드이펙트 0: useState/useEffect/타이핑/외부 훅 모두 없음.
 */
export function IndustryPreview({ selectedIndustryName }: IndustryPreviewProps) {
  return (
    <div
      className="flex min-h-0 flex-col bg-background px-6 pointer-events-none select-none"
      aria-hidden
    >
      {/* 헤더 — "창업" 만 그라데이션 */}
      <div className="pt-16 pb-6">
        <h2 className="text-xl font-bold text-left leading-snug">
          {HEADER_TEXT.split("창업").map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <span style={GRADIENT_STYLE}>창업</span>
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* 검색 버튼 — visual only */}
        <div className="flex w-full items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          업종 검색...
        </div>

        {/* 핫한 창업 아이템 추천 */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            🔥 핫한 창업 아이템
          </h3>
          <div className="flex flex-wrap gap-2">
            {ONBOARDING_INDUSTRIES.map((industry) => (
              <div
                key={industry.name}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  selectedIndustryName === industry.name
                    ? "border-2 border-[var(--onboarding-chip-border-selected)] bg-[var(--onboarding-chip-selected)]"
                    : "bg-background",
                )}
              >
                {industry.emoji} {industry.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
