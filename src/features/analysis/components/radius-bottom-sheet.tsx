"use client";

import { formatRadius } from "@/lib/geo-utils";

interface RadiusBottomSheetProps {
  address: string;
  industryName: string;
  radius: number;
  onAnalyze: () => void;
  /** 반경 내 경쟁업체 수 */
  nearbyCount?: number;
}

/** Step 5: 반경 요약 + 분석 시작 바텀시트 (PRD Step 5) */
export function RadiusBottomSheet({
  address,
  industryName,
  radius,
  onAnalyze,
  nearbyCount,
}: RadiusBottomSheetProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t px-4 pt-4 pb-8">
      {/* 드래그 핸들 */}
      <div className="flex justify-center pb-3">
        <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
      </div>

      {/* 요약 정보 */}
      <div className="flex items-center gap-2 text-sm text-foreground mb-4">
        <span className="truncate font-medium">📍 {address}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 font-medium">{industryName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 text-violet-600 font-bold">
          반경 {formatRadius(radius)}
        </span>
      </div>

      {/* 경쟁업체 수 */}
      {nearbyCount != null && nearbyCount > 0 && (
        <p className="text-sm text-muted-foreground mb-3">
          🏪 반경 내 <span className="font-bold text-violet-600">{nearbyCount}개</span> 경쟁업체 발견
        </p>
      )}

      {/* 분석 시작 버튼 */}
      <button
        type="button"
        onClick={onAnalyze}
        className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-base transition-colors hover:bg-violet-700 active:bg-violet-800"
      >
        분석 시작하기
      </button>
    </div>
  );
}
