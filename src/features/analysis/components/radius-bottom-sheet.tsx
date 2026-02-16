"use client";

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${m}m`;
}

interface RadiusBottomSheetProps {
  address: string;
  industryName: string;
  radius: number;
  nearbyCount: number;
  onAnalyze: () => void;
  isSubmitting: boolean;
}

export function RadiusBottomSheet({
  address, industryName, radius, nearbyCount, onAnalyze, isSubmitting,
}: RadiusBottomSheetProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t px-4 pt-3 pb-6">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
        <span className="truncate font-medium">{address}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 font-medium">{industryName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 text-violet-600 font-bold">
          {formatRadius(radius)}
        </span>
      </div>

      {/* 경쟁업체 수 */}
      <p className="text-xs text-muted-foreground mb-3 px-1">
        반경 내 경쟁업체 {nearbyCount >= 45 ? `${nearbyCount}+` : nearbyCount}개
      </p>

      {/* 버튼 */}
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
