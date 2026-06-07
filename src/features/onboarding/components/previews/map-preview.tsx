import { RADIUS_OPTIONS } from "@/constants/enums/radius-option";
import { formatRadius } from "@/lib/format";
import { FakeMap } from "./fake-map";

interface MapPreviewProps {
  address: string;
  industryName: string;
  /** 강조 표시할 반경 (default 300) */
  radius?: number;
}

/**
 * Fold 5 — MapRadiusStep 시각 재현.
 * Kakao Map 대신 FakeMap, BackButton 없음, 모든 인터랙션 없음.
 */
export function MapPreview({
  address,
  industryName,
  radius = 300,
}: MapPreviewProps) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
      {/* 배경 가짜 지도 */}
      <FakeMap radius={radius} />

      {/* 바텀시트 — RadiusBottomSheet 시각 그대로, 모든 핸들러 없음 */}
      <div className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t px-4 pt-3 pb-6">
        {/* 주소 + 업종 헤더 */}
        <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
          <span className="truncate font-medium">{address}</span>
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 font-medium">{industryName}</span>
        </div>

        {/* 반경 선택 버튼 — visual only */}
        <div className="flex gap-2 mb-3">
          {RADIUS_OPTIONS.map((option) => {
            const selected = radius === option.value;
            return (
              <div
                key={option.value}
                className={`flex-1 rounded-lg border py-2 text-center text-sm ${
                  selected
                    ? "border-violet-600 bg-violet-50 text-violet-600 font-bold"
                    : "border-border"
                }`}
              >
                <div className="font-bold">{option.label}</div>
                <div
                  className={`text-[11px] ${
                    selected ? "text-violet-500" : "text-muted-foreground"
                  }`}
                >
                  {option.description}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mb-3 px-1">
          반경 {formatRadius(radius)} 내 경쟁업체 분석
        </p>

        {/* 분석 시작하기 — visual only */}
        <div className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-base flex items-center justify-center">
          분석 시작하기
        </div>
      </div>
    </div>
  );
}
