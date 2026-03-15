"use client";

import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "공공 API에서 데이터를 수집하고 있습니다...",
  "경쟁 매장 분석 중...",
  "골목상권 유동인구 데이터 처리 중...",
  "지하철·버스 인프라 분석 중...",
  "다중 지표 점수 산출 중...",
];

/** 분석 진행 중 바텀시트 스켈레톤 */
export function AnalysisResultSkeleton() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* 배경 지도 플레이스홀더 */}
      <div className="absolute inset-0 bg-muted animate-pulse" />

      {/* 바텀시트 스켈레톤 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t flex flex-col overflow-hidden rounded-t-2xl pointer-events-auto"
        style={{ maxHeight: "85dvh" }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-3 shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 스켈레톤 */}
        <div className="shrink-0 px-4 space-y-3">
          {/* 마커 범례 스켈레톤 */}
          <div className="flex gap-1.5 mt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-6 rounded-full bg-muted animate-pulse"
              />
            ))}
          </div>

          {/* 등급 + 주소 스켈레톤 */}
          <div className="flex items-start gap-3">
            {/* 등급 배지 스켈레톤 */}
            <div className="h-16 w-14 rounded-xl bg-muted animate-pulse shrink-0" />
            {/* 주소/업종 텍스트 스켈레톤 */}
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse mt-3" />
            </div>
          </div>
        </div>

        {/* 지표 카드 스켈레톤 */}
        <div className="px-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>

          {/* 팩트 항목 스켈레톤 */}
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* 하단 CTA 스켈레톤 */}
        <div className="shrink-0 px-4 pb-3 pt-3 border-t bg-background mt-auto space-y-2.5">
          {/* 진행 상태 텍스트 */}
          <div className="flex items-center gap-2 justify-center py-1">
            <span
              className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0"
              style={{ animation: "analysis-led 1.5s ease-in-out infinite" }}
            />
            <p className="text-xs text-muted-foreground transition-opacity duration-500">
              {LOADING_MESSAGES[msgIndex]}
            </p>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
@keyframes analysis-led {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}` }} />
          {/* CTA 버튼 스켈레톤 */}
          <div className="h-12 w-full rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
