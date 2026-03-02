"use client";

import { RADIUS_OPTIONS } from "@/constants/enums/radius-option";

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${m}m`;
}

interface RadiusBottomSheetProps {
  address: string;
  industryName: string;
  radius: number;
  nearbyCount: number;
  onRadiusChange: (radius: number) => void;
  onAnalyze: () => void;
  isSubmitting: boolean;
}

export function RadiusBottomSheet({
  address, industryName, radius, nearbyCount, onRadiusChange, onAnalyze, isSubmitting,
}: RadiusBottomSheetProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t px-4 pt-3 pb-6">
      {/* 주소 + 업종 헤더 */}
      <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
        <span className="truncate font-medium">{address}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 font-medium">{industryName}</span>
      </div>

      {/* 반경 선택 버튼 */}
      <div className="flex gap-2 mb-3">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onRadiusChange(option.value)}
            className={`flex-1 rounded-lg border py-2 text-center text-sm transition-colors ${
              radius === option.value
                ? "border-violet-600 bg-violet-50 text-violet-600 font-bold"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="font-bold">{option.label}</div>
            <div className="text-xs text-muted-foreground">{option.description}</div>
          </button>
        ))}
      </div>

      {/* 경쟁업체 수 */}
      <p className="text-xs text-muted-foreground mb-3 px-1">
        반경 {formatRadius(radius)} 내 경쟁업체 {nearbyCount >= 45 ? `${nearbyCount}+` : nearbyCount}개
      </p>

      {/* 분석하기 버튼 */}
      <button
        type="button"
        onClick={onAnalyze}
        disabled={isSubmitting}
        className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-base transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50"
      >
        {isSubmitting ? "분석 요청 중..." : "분석 시작하기"}
      </button>
    </div>
  );
}
