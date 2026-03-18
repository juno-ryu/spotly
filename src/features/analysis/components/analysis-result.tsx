"use client";

import { useState, useRef, memo, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { CompetitorMap } from "./competitor-map";
import { GradeBadge } from "./grade-badge";
import { MetricCards } from "./metric-cards";
import { DataFacts } from "./data-facts";
import { formatRadius } from "@/lib/format";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";
import type { AnalysisRequest } from "@prisma/client";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import type { InsightData } from "@/features/analysis/lib/insights/types";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";
import {
  buildCompetitionHeader,
  buildVitalityHeader,
  buildPopulationHeader,
  buildTransitHeader,
} from "@/features/analysis/lib/insights/builder";

/** 데이터 소스 티커 — 수집하는 모든 데이터 항목 */
const DATA_SOURCES = [
  "카카오 Places 경쟁 매장 분석",
  "프랜차이즈 브랜드 매칭 분석",
  "반경 내 경쟁업체 밀집도 계산",
  "업종별 프랜차이즈 비율 분석",
  "서울 골목상권 매출 데이터 수집",
  "상권변화지표 (확장/포화/불안정) 분석",
  "유동인구 시간대·요일·연령 분석",
  "점포 개업·폐업률 계산",
  "KOSIS 행정동 배후인구 조회",
  "지하철 역세권 승하차 데이터 분석",
  "버스 정류장·노선 수 조회 (TAGO)",
  "초·중·고등학교 위치 DB 검색",
  "대학교 반경 탐색 (카카오)",
  "종합병원·의료원 반경 탐색",
];



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
/** 지도 마커 범례 (이모지 + 색상) */
const MAP_LEGENDS = [
  { emoji: "📍", color: "#7c3aed", label: "내 위치", pin: true },
  { emoji: "", color: "#7c3aed", label: "동종업체", pin: false },
  { emoji: "🚇", color: "#2563eb", label: "지하철", pin: true },
  { emoji: "🚌", color: "#ea580c", label: "버스", pin: true },
  { emoji: "🏫", color: "#16a34a", label: "학교", pin: true },
  { emoji: "🎓", color: "#4f46e5", label: "대학교", pin: true },
  { emoji: "🏥", color: "#dc2626", label: "병의원", pin: true },
] as const;

/** 마커 범례 — AvatarGroup + AvatarGroupCount(+) 클릭 시 펼침 */
function MapLegend() {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center mt-1">
        {MAP_LEGENDS.map(({ emoji, color, label }) => (
          <span key={label} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Avatar size="sm" style={{ border: `2px solid ${emoji ? color : "white"}` }}>
              <AvatarFallback
                className="text-[9px]"
                style={{ background: emoji ? "white" : color }}
              >
                {emoji || ""}
              </AvatarFallback>
            </Avatar>
            {label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          접기
        </button>
      </div>
    );
  }

  return (
    <AvatarGroup className="mt-1">
      {MAP_LEGENDS.map(({ emoji, color, label }) => (
        <Avatar key={label} size="sm" style={{ border: `2px solid ${emoji ? color : "white"}` }}>
          <AvatarFallback
            className="text-[9px]"
            style={{ background: emoji ? "white" : color }}
          >
            {emoji || ""}
          </AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount
        className="size-6 text-[10px] cursor-pointer hover:bg-muted/80"
        onClick={() => setExpanded(true)}
      >
        +
      </AvatarGroupCount>
    </AvatarGroup>
  );
}

function HeaderWithGrade({
  address,
  radiusLabel,
  industryName,
  totalCount,
  totalScore,
  insightData,
}: {
  address: string;
  radiusLabel: string;
  industryName: string;
  totalCount: number;
  totalScore: number | null;
  insightData: InsightData | null;
}) {
  // 기존 인사이트 빌더로 한 줄 총평 — 가장 눈에 띄는 지표 선택
  const summary = (() => {
    if (!insightData) return null;
    const candidates = [
      buildCompetitionHeader(insightData),
      buildVitalityHeader(insightData),
      buildPopulationHeader(insightData),
      buildTransitHeader(insightData),
    ].filter(Boolean);
    if (candidates.length === 0) return null;
    // 가장 강한 시그널 (A/F 우선, 그 다음 B/D, 마지막 C)
    const gradeWeight: Record<string, number> = { A: 3, F: 3, B: 2, D: 2, C: 1 };
    return candidates.sort((a, b) => {
      const ga = a!.text.includes("적어") || a!.text.includes("우수") || a!.text.includes("풍부") ? 3
        : a!.text.includes("치열") || a!.text.includes("부족") || a!.text.includes("낮") ? 3 : 1;
      const gb = b!.text.includes("적어") || b!.text.includes("우수") || b!.text.includes("풍부") ? 3
        : b!.text.includes("치열") || b!.text.includes("부족") || b!.text.includes("낮") ? 3 : 1;
      return gb - ga;
    })[0];
  })();

  return (
    <div className="shrink-0 px-4 space-y-3">
      {/* 마커 범례 — AvatarGroup (클릭 시 펼침) */}
      <MapLegend />

      {/* 등급(좌) + 주소/업종/총평(우) */}
      <div className="flex items-start gap-3">
        {totalScore != null && (
          <div className="shrink-0">
            <GradeBadge totalScore={totalScore} />
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
          <div>
            <p className="text-[13px] text-foreground/80 break-keep leading-snug">
              📍{" "}
              <span className="font-bold" style={GRADIENT_TEXT_STYLE}>
                {address}
              </span>{" "}
              부근
            </p>
            <p className="text-[13px] text-foreground/80">
              반경{" "}
              <span className="font-bold" style={GRADIENT_TEXT_STYLE}>{radiusLabel}</span>
              {" · "}
              <span className="font-bold" style={GRADIENT_TEXT_STYLE}>{industryName}</span>
              {" "}
              <span className="font-bold" style={GRADIENT_TEXT_STYLE}>{totalCount}개</span>
            </p>
          </div>
          {summary && (
            <p className="text-[12px] text-muted-foreground">
              {summary.emoji} {summary.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */

interface AnalysisResultProps {
  data: AnalysisRequest;
}

const SHEET_MIN_HEIGHT = 140;

export function AnalysisResult({ data }: AnalysisResultProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // fit-content 상태에서 측정한 초기 콘텐츠 높이 (스냅 복귀 시 사용)
  const contentHeightRef = useRef<number>(0);

  // 리포트 조회 — GA4 이벤트 전송 (최초 마운트 시 1회)
  useEffect(() => {
    trackEvent(AnalyticsEvent.REPORT_VIEW, { analysis_id: data.id });
  }, [data.id]);

  // 마운트 후 콘텐츠 높이 측정
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (sheetRef.current) {
        contentHeightRef.current = sheetRef.current.getBoundingClientRect().height;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 드래그 이벤트 등록 (touch + mouse 크로스플랫폼)
  useEffect(() => {
    const handle = handleRef.current;
    const sheet = sheetRef.current;
    if (!handle || !sheet) return;

    let startY = 0;
    let startH = 0;
    let dragging = false;

    function snap() {
      const h = sheet!.getBoundingClientRect().height;
      const vh = window.innerHeight;
      sheet!.style.transition = "max-height 0.3s ease-out";
      if (h < vh * 0.25) {
        sheet!.style.maxHeight = `${SHEET_MIN_HEIGHT}px`;
      } else if (h < vh * 0.7) {
        sheet!.style.maxHeight = `${contentHeightRef.current || h}px`;
      } else {
        sheet!.style.maxHeight = `${vh * 0.95}px`;
      }
    }

    function move(clientY: number) {
      const deltaY = startY - clientY;
      const max = window.innerHeight * 0.95;
      const next = Math.max(SHEET_MIN_HEIGHT, Math.min(max, startH + deltaY));
      sheet!.style.maxHeight = `${next}px`;
    }

    // ── Touch ──
    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      startH = sheet!.getBoundingClientRect().height;
      dragging = true;
      sheet!.style.transition = "none";
      sheet!.style.maxHeight = `${startH}px`;
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      e.preventDefault();
      move(e.touches[0].clientY);
    }
    function onTouchEnd() {
      if (!dragging) return;
      dragging = false;
      snap();
    }

    // ── Mouse ──
    function onMouseDown(e: MouseEvent) {
      startY = e.clientY;
      startH = sheet!.getBoundingClientRect().height;
      dragging = true;
      sheet!.style.transition = "none";
      sheet!.style.maxHeight = `${startH}px`;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      move(e.clientY);
    }
    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      snap();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: false });
    handle.addEventListener("touchend", onTouchEnd, { passive: true });
    handle.addEventListener("mousedown", onMouseDown);

    return () => {
      handle.removeEventListener("touchstart", onTouchStart);
      handle.removeEventListener("touchmove", onTouchMove);
      handle.removeEventListener("touchend", onTouchEnd);
      handle.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  /* ──────────── 분석 결과 렌더링 ──────────── */
  const radiusLabel = formatRadius(data.radius);
  const report = data.reportData as Record<string, unknown> | undefined;

  const places = report?.places as
    | { totalCount: number; fetchedCount: number }
    | undefined;
  const subway = (report?.subway ?? null) as SubwayAnalysis | null;
  const bus = (report?.bus ?? null) as BusAnalysis | null;
  const school = (report?.school ?? null) as SchoolAnalysis | null;
  const university = (report?.university ?? null) as UniversityAnalysis | null;
  const medical = (report?.medical ?? null) as MedicalAnalysis | null;
  const centerLat = report?.centerLatitude as number | undefined;
  const centerLng = report?.centerLongitude as number | undefined;

  const scoreDetail = data.scoreDetail as ScoreBreakdown | undefined;
  // 활력도 데이터 존재 여부로 서울 여부 판단
  const isSeoul = !!(report as Record<string, unknown>)?.isSeoul;

  // 인사이트 빌더용 데이터 (총평 생성에 사용)
  const insightData: InsightData = {
    competition: (report?.competition ?? null) as InsightData["competition"],
    vitality: (report?.vitality ?? null) as InsightData["vitality"],
    places: places ?? null,
    industryName: data.industryName,
    radius: data.radius,
    subway,
    bus,
    school,
    university,
    medical,
    population: (report?.populationAnalysis ?? null) as InsightData["population"],
  };

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* ── 배경 지도 ── */}
      {centerLat && centerLng ? (
        <div className="absolute inset-0 pointer-events-auto">
          <CompetitorMap
            centerLat={centerLat}
            centerLng={centerLng}
            radius={data.radius}
            keyword={(report?.industryKeyword as string) || data.industryName}
            subway={subway}
            bus={bus}
            school={school}
            university={university}
            medical={medical}
            fullScreen
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center pointer-events-auto">
          <p className="text-muted-foreground text-sm">
            지도 데이터가 없습니다
          </p>
        </div>
      )}

      {/* ── 바텀시트: 최초 콘텐츠 높이, 최대 95dvh ── */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-40 bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t flex flex-col overflow-hidden rounded-t-2xl pointer-events-auto"
        style={{ maxHeight: "85dvh" }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
@keyframes source-led {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}` }} />
        {/* 드래그 핸들 */}
        <div
          ref={handleRef}
          className="flex justify-center pt-3 pb-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 + 등급 (flex-row) */}
        <HeaderWithGrade
          address={data.address}
          radiusLabel={radiusLabel}
          industryName={data.industryName}
          totalCount={places?.totalCount ?? 0}
          totalScore={data.totalScore}
          insightData={insightData}
        />

        {/* ── 미리보기 콘텐츠: 지표 카드 + 팩트 ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 mt-4 space-y-5">
          <MetricCards
            scoreDetail={scoreDetail}
            reportData={report}
            isSeoul={isSeoul}
          />
          <DataFacts
            subway={subway}
            bus={bus}
            school={school}
            university={university}
            medical={medical}
            ticker={<SourceTicker sources={DATA_SOURCES} />}
          />
        </div>

        {/* ── 후기 슬라이드 + CTA ── */}
        <div className="shrink-0 px-4 pb-3 pt-3 border-t bg-background space-y-2.5">

          {data.aiReportJson ? (
            <Link
              href={`/report/${data.id}`}
              className="flex items-center justify-center gap-1.5 w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-sm transition-transform hover:bg-violet-700 active:scale-95"
            >
              이전에 받은 리포트 보기
              <span className="text-base leading-none">→</span>
            </Link>
          ) : (
            <Link
              href={`/analyze/${data.id}/purchase`}
              className="flex items-center justify-center gap-1.5 w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-sm transition-transform hover:bg-violet-700 active:scale-95"
            >
              AI 전문가 분석 받기
              <span className="text-base leading-none">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}