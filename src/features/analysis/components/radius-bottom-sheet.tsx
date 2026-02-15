"use client";

import { useMemo } from "react";
import { computeInsights, type InsightInput } from "../lib/insight-engine";

// ── 컴포넌트 ──

interface RadiusBottomSheetProps {
  address: string;
  industryCode: string;
  industryName: string;
  radius: number;
  onAnalyze: () => void;
  npsTotalCount: number;
  npsActiveCount: number;
  avgEmployeeCount: number;
  employeeGrowthRate: number | null;
  nearbyCount: number;
  transactionCount: number;
  avgAptPrice: number;
  districtTransactionCount: number;
  population: { totalPopulation: number; households: number } | null;
  dongName: string | null;
}

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${m}m`;
}

/** Step 5: 반경 요약 + 분석 시작 바텀시트 (v2 스코어링 정렬) */
export function RadiusBottomSheet({
  address,
  industryCode,
  industryName,
  radius,
  onAnalyze,
  npsTotalCount,
  npsActiveCount,
  avgEmployeeCount,
  employeeGrowthRate,
  nearbyCount,
  transactionCount,
  avgAptPrice,
  districtTransactionCount,
  population,
  dongName,
}: RadiusBottomSheetProps) {
  // v2 스코어링 라이트 — 동일 기준으로 인사이트 계산
  const insights = useMemo(() => {
    const input: InsightInput = {
      npsTotalCount,
      npsActiveCount,
      avgEmployeeCount,
      employeeGrowthRate,
      nearbyCount,
      transactionCount,
      avgAptPrice,
      districtTransactionCount,
      population,
      radius,
      industryCode,
      industryName,
      address,
      dongName,
    };
    return computeInsights(input);
  }, [
    npsTotalCount, npsActiveCount, avgEmployeeCount, employeeGrowthRate,
    nearbyCount, transactionCount, avgAptPrice, districtTransactionCount,
    population, radius, industryCode, industryName, address, dongName,
  ]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t px-4 pt-4 pb-8">
      {/* 드래그 핸들 */}
      <div className="flex justify-center pb-3">
        <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
      </div>

      {/* 요약 정보 */}
      <div className="flex items-center gap-2 text-sm text-foreground mb-3">
        <span className="truncate font-medium">{address}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 font-medium">{industryName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 text-violet-600 font-bold">
          반경 {formatRadius(radius)}
        </span>
      </div>

      {/* 인사이트 카드 */}
      <div className="space-y-2 mb-3">
        {/* 1. 경쟁업체 — v2 밀도 기반 */}
        <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">
              📍 반경 내 {industryName} 경쟁업체
            </span>
            <span className="text-lg font-bold text-violet-600">
              {nearbyCount >= 45 ? "45개+" : `${nearbyCount}개`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {insights.competition.message}
          </p>
          {insights.competition.detail && (
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              {insights.competition.detail}
            </p>
          )}
          {insights.competition.sampleNote && (
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              {insights.competition.sampleNote}
            </p>
          )}
        </div>

        {/* 2. 상권 활력도 — v2 복합 지표 */}
        {insights.vitality && (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-medium text-foreground">📊 상권 활력도</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {insights.vitality.message}
            </p>
            {insights.vitality.detail && (
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                {insights.vitality.detail}
              </p>
            )}
            {insights.vitality.sampleNote && (
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                {insights.vitality.sampleNote}
              </p>
            )}
          </div>
        )}

        {/* 3. 구매력 — v2 상대 기준 (전국 평균 대비) */}
        {insights.purchasing && (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground mb-1">💰 구매력</p>
            <p className="text-xs text-muted-foreground">
              {insights.purchasing.message}
            </p>
            {insights.purchasing.detail && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 whitespace-pre-line">
                {insights.purchasing.detail}
              </p>
            )}
          </div>
        )}
      </div>

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
