"use client";

import { useState, useRef, useCallback, memo, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAnalysisPolling } from "../hooks/use-analysis-polling";
import { CompetitorMap } from "./competitor-map";
import { AnalysisSkeleton } from "./analysis-skeleton";
import { formatRadius } from "@/lib/format";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import { buildInsights } from "../lib/insights";
import type { InsightItem, CompetitionAnalysis } from "../lib/insights";
import type { VitalityAnalysis } from "../lib/scoring/vitality";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

/** 데이터 소스 티커 */
const DATA_SOURCES = [
  "카카오 Places 경쟁 매장 분석",
  "프랜차이즈 브랜드 매칭 분석",
  "반경 내 경쟁업체 밀집도 계산",
  "업종별 프랜차이즈 비율 분석",
];

const animStyles = `
@keyframes source-led {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes insight-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}`;

const SourceTicker = memo(function SourceTicker({
  sources,
}: {
  sources: string[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % sources.length);
    }, 2500);
    return () => clearInterval(id);
  }, [sources.length]);

  return (
    <div
      className="h-[14px] ml-2 relative shrink-0 min-w-0"
      style={{ overflowX: "visible", overflowY: "clip" }}
    >
      {sources.map((src, i) => (
        <div
          key={src}
          className={cn(
            "absolute left-0 flex items-center gap-1 h-[14px] text-[10px] whitespace-nowrap transition-all duration-1000 ease-in-out",
            i === activeIndex
              ? "translate-y-0 opacity-100 text-muted-foreground/50"
              : i === (activeIndex - 1 + sources.length) % sources.length
                ? "-translate-y-full opacity-0"
                : "translate-y-full opacity-0",
          )}
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
            style={{ animation: "source-led 2s ease-in-out infinite" }}
          />
          {src}
        </div>
      ))}
    </div>
  );
});

/** 헤더 — 하이라이트 텍스트 */
function Header({
  address,
  radiusLabel,
  industryName,
  totalCount,
}: {
  address: string;
  radiusLabel: string;
  industryName: string;
  totalCount: number;
}) {
  return (
    <div className="shrink-0 px-4">
      <p className="text-sm text-foreground/80 break-keep whitespace-pre-line leading-relaxed">
        📍{" "}
        <span className="text-base font-bold" style={GRADIENT_TEXT_STYLE}>
          {address}
        </span>{" "}
        부근{"\n"}반경{" "}
        <span className="text-base font-bold" style={GRADIENT_TEXT_STYLE}>
          {radiusLabel}
        </span>{" "}
        내{" "}
        <span className="text-base font-bold" style={GRADIENT_TEXT_STYLE}>
          {industryName}
        </span>{" "}
        업장{" "}
        <span className="text-base font-bold" style={GRADIENT_TEXT_STYLE}>
          {totalCount}개
        </span>
        를 찾았어요 ✨
      </p>
      <SourceTicker sources={DATA_SOURCES} />
    </div>
  );
}

/** 경쟁 등급별 설정 */
const GRADE_CONFIG: Record<string, { summary: string; badge: string }> = {
  A: { summary: "경쟁이 매우 낮아 창업에 유리한 상권이에요", badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  B: { summary: "경쟁이 적당한 편으로 좋은 조건이에요", badge: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  C: { summary: "상권 경쟁이 치열할 것으로 예상돼요", badge: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  D: { summary: "경쟁이 높아 신중한 접근이 필요해요", badge: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  F: { summary: "경쟁이 매우 치열해 창업 시 주의가 필요해요", badge: "bg-red-100 text-red-700 hover:bg-red-100" },
};

/** 인사이트 항목 — 순차 페이드인 */
function Insight({ item, delay }: { item: InsightItem; delay: number }) {
  return (
    <div
      className="flex gap-2.5 py-2.5 animate-[insight-in_0.4s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-sm leading-5 shrink-0">{item.emoji}</span>
      <div className="min-w-0">
        <p className="text-[13px] text-foreground leading-5 break-keep">
          {item.text}
        </p>
        {item.sub && (
          <p className="text-[11px] text-muted-foreground/60 mt-1 leading-4 flex items-center gap-1">
            <span className="text-muted-foreground/30">›</span> {item.sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */

interface AnalysisResultProps {
  analysisId: string;
}

/** 바텀시트 스냅: collapsed(140px) → half(50dvh) → full(100dvh) */
type SheetSnap = "collapsed" | "half" | "full";
const SNAP_HEIGHT: Record<SheetSnap, string> = {
  collapsed: "140px",
  half: "50dvh",
  full: "95dvh",
};

export function AnalysisResult({ analysisId }: AnalysisResultProps) {
  const { data, isLoading, error } = useAnalysisPolling(analysisId);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const startHeight = useRef(0);
  const isDragging = useRef(false);

  const applySnap = useCallback((s: SheetSnap) => {
    setSnap(s);
    if (sheetRef.current) {
      sheetRef.current.style.maxHeight = SNAP_HEIGHT[s];
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    touchStartY.current = e.touches[0].clientY;
    startHeight.current = sheet.getBoundingClientRect().height;
    isDragging.current = true;
    sheet.style.transition = "none";
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const deltaY = touchStartY.current - e.touches[0].clientY;
    const newHeight = Math.max(
      140,
      Math.min(window.innerHeight, startHeight.current + deltaY),
    );
    sheetRef.current.style.maxHeight = `${newHeight}px`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    const h = sheetRef.current.getBoundingClientRect().height;
    const vh = window.innerHeight;
    sheetRef.current.style.transition = "";
    // 3단 스냅: <25% → collapsed, 25~70% → half, >70% → full
    if (h < vh * 0.25) applySnap("collapsed");
    else if (h < vh * 0.7) applySnap("half");
    else applySnap("full");
  }, [applySnap]);

  const handleHandleClick = useCallback(() => {
    // 클릭 시 순환: collapsed → half → full → collapsed
    setSnap((prev) => {
      const next: SheetSnap = prev === "collapsed" ? "half" : prev === "half" ? "full" : "collapsed";
      if (sheetRef.current) sheetRef.current.style.maxHeight = SNAP_HEIGHT[next];
      return next;
    });
  }, []);

  if (isLoading) return <AnalysisSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl bg-muted/50 py-12 text-center px-4">
        <p className="text-destructive font-medium">
          분석 결과를 불러올 수 없습니다.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          새 분석 시작
        </Link>
      </div>
    );
  }

  if (!data) return null;

  /* 분석 진행 중 */
  if (data.status === "PENDING" || data.status === "PROCESSING") {
    return (
      <div className="rounded-xl bg-muted/50 py-16 text-center px-4 space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
          <div className="h-5 w-5 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-foreground">분석 진행 중...</h2>
        <p className="text-sm text-muted-foreground">
          공공 데이터를 수집하고 분석하고 있습니다
        </p>
        <span className="inline-block rounded-full bg-violet-50 dark:bg-violet-950/30 px-3 py-1 text-xs font-medium text-violet-600">
          {data.status === "PENDING" ? "대기중" : "분석중"}
        </span>
      </div>
    );
  }

  /* 분석 실패 */
  if (data.status === "FAILED") {
    return (
      <div className="rounded-xl bg-muted/50 py-12 text-center px-4 space-y-4">
        <p className="text-destructive font-medium">분석에 실패했습니다.</p>
        <p className="text-sm text-muted-foreground">
          잠시 후 다시 시도해주세요.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          다시 시도
        </Link>
      </div>
    );
  }

  /* ──────────── 분석 완료 ──────────── */
  const radiusLabel = formatRadius(data.radius);
  const report = data.reportData as Record<string, unknown> | undefined;

  const places = report?.places as
    | { totalCount: number; fetchedCount: number }
    | undefined;
  const competition = report?.competition as CompetitionAnalysis | undefined;
  const vitality = report?.vitality as VitalityAnalysis | undefined;
  const centerLat = report?.centerLatitude as number | undefined;
  const centerLng = report?.centerLongitude as number | undefined;

  const competitionGrade = competition?.competitionScore?.grade ?? "-";

  const allInsights = buildInsights({
    competition: competition ?? null,
    vitality: vitality ?? null,
    places: places ?? null,
    industryName: data.industryName,
    radius: data.radius,
  });

  return (
    <div className="fixed inset-0">
      {/* ── 배경 지도 ── */}
      {centerLat && centerLng ? (
        <CompetitorMap
          centerLat={centerLat}
          centerLng={centerLng}
          radius={data.radius}
          keyword={data.industryName}
          fullScreen
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            지도 데이터가 없습니다
          </p>
        </div>
      )}

      {/* ── 바텀시트 ── */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t flex flex-col overflow-hidden transition-[max-height] duration-300 ease-out",
          snap === "full" ? "rounded-none" : "rounded-t-2xl",
        )}
        style={{ maxHeight: SNAP_HEIGHT[snap] }}
      >
        <style dangerouslySetInnerHTML={{ __html: animStyles }} />
        {/* 드래그 핸들 */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleClick}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 */}
        <Header
          address={data.address}
          radiusLabel={radiusLabel}
          industryName={data.industryName}
          totalCount={places?.totalCount ?? 0}
        />

        {/* ── 콘텐츠 ── */}
        <div
          className="flex-1 overflow-y-auto px-4 pb-10 mt-3"
          onClick={() => snap !== "full" && applySnap("full")}
        >
          <Accordion type="multiple" defaultValue={["competition"]}>
            <AccordionItem value="competition">
              <AccordionTrigger>
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    경쟁강도
                    <Badge className={GRADE_CONFIG[competitionGrade]?.badge ?? GRADE_CONFIG.C.badge}>
                      {competitionGrade}
                    </Badge>
                  </p>
                  <p className="text-[12px] text-muted-foreground font-normal mt-0.5">
                    {GRADE_CONFIG[competitionGrade]?.summary ?? GRADE_CONFIG.C.summary}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {allInsights.length > 0 && (
                  <div className="space-y-0.5">
                    {allInsights.map((item, i) => (
                      <Insight key={i} item={item} delay={i * 150} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* ── 하단 고정 CTA ── */}
        <div className="shrink-0 px-4 pb-3 pt-2 border-t bg-background">
          <p className="text-center text-[11px] text-muted-foreground mb-2">
            AI가 분석한 맞춤 리포트를 확인해보세요
          </p>
          <Link
            href={`/report/${analysisId}`}
            className="relative flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-sm transition-colors hover:bg-violet-700 active:bg-violet-800"
          >
            AI 맞춤 리포트 받기
          </Link>
        </div>
      </div>
    </div>
  );
}
