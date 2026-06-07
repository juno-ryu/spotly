import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { HOT_STARTUP_AREAS } from "../../constants/regions";

interface RegionPreviewProps {
  /** 헤더에 그라데이션으로 표시할 업종명 */
  industryName: string;
  /** 헤더 앞에 붙는 이모지 */
  industryEmoji?: string;
}

/**
 * Fold 4 — RegionSelector 시각 재현.
 * 사이드이펙트 0.
 */
export function RegionPreview({
  industryName,
  industryEmoji = "☕",
}: RegionPreviewProps) {
  return (
    <div
      className="flex min-h-0 flex-col bg-background px-6 pointer-events-none select-none"
      aria-hidden
    >
      {/* 헤더 — 이모지 + 업종명 그라데이션 + 본문 */}
      <div className="pt-16 pb-6">
        <h2 className="text-xl font-bold text-left leading-snug">
          <span>{industryEmoji}</span>{" "}
          <span style={GRADIENT_STYLE} className="font-black">
            {industryName}
          </span>{" "}
          창업,
          <br />
          어디에서 시작할까요?
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* 검색 버튼 — visual only */}
        <div className="flex w-full items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          주소, 건물명, 역 이름 검색...
        </div>

        {/* 현재 위치 버튼 — visual only */}
        <Button
          variant="secondary"
          className="w-full rounded-full h-13 text-base font-semibold"
          asChild
        >
          <div>📍 현재 위치로 시작</div>
        </Button>

        {/* 핫한 창업지역 추천 */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            🔥 지금 핫한 창업지역
          </h3>
          <div className="flex flex-wrap gap-2">
            {HOT_STARTUP_AREAS.map((area) => (
              <div
                key={area.name}
                className="rounded-full border bg-background px-4 py-2 text-sm font-medium"
              >
                {area.emoji} {area.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
