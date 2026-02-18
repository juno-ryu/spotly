"use client";

import { useState, useRef, memo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompetitorMap } from "./competitor-map";
import { formatRadius } from "@/lib/format";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import dayjs from "dayjs";
import { buildCompetitionInsights, buildVitalityInsights } from "../lib/insights";
import { generateReport } from "@/features/report/actions";
import type { InsightItem, CompetitionAnalysis } from "../lib/insights";
import type { VitalityAnalysis } from "../lib/scoring/vitality";
import type { AnalysisRequest } from "@prisma/client";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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

/** 등급 뱃지 공통 스타일 */
const BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  B: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  C: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  D: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  F: "bg-red-100 text-red-700 hover:bg-red-100",
};

/** 경쟁강도 등급별 설명 */
const COMPETITION_GRADE: Record<string, string> = {
  A: "경쟁이 매우 낮아 창업에 유리한 상권이에요",
  B: "경쟁이 적당한 편으로 좋은 조건이에요",
  C: "상권 경쟁이 치열할 것으로 예상돼요",
  D: "경쟁이 높아 신중한 접근이 필요해요",
  F: "경쟁이 매우 치열해 창업 시 주의가 필요해요",
};

/** 상권 활력도 등급별 설명 */
const VITALITY_GRADE: Record<string, string> = {
  A: "활력이 좋은 상권이에요",
  B: "상권 활력이 양호한 편이에요",
  C: "상권 활력이 보통 수준이에요",
  D: "상권 활력이 다소 낮아요",
  F: "상권 활력이 낮은 편이에요",
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
  data: AnalysisRequest;
}

const SHEET_MIN_HEIGHT = 140;

/** 순환 후기 */
const TESTIMONIALS = [
  {
    text: "보증금 3천만원 날릴 뻔했어요. 리포트 보고 위치 바꿨습니다",
    author: "성북구 카페 예비창업자",
    seed: "startup42",
    bg: "b6e3f4",
  },
  {
    text: "경쟁업체 분석이 너무 정확해요. 컨설팅 50만원 낭비할 뻔했어요",
    author: "마포구 음식점 준비생",
    seed: "chef88",
    bg: "ffd5dc",
  },
  {
    text: "주변 상권이 포화인 걸 미리 알고 동네 바꿨어요. 진짜 살았다",
    author: "서초구 치킨집 예비창업자",
    seed: "chicken77",
    bg: "d1f4d1",
  },
  {
    text: "이 가격에 이런 분석이라니 말이 안 돼요. 강추합니다",
    author: "송파구 미용실 창업자",
    seed: "beauty99",
    bg: "c0aede",
  },
] as const;

/** 무료 vs AI 리포트 비교 항목 */
const COMPARISON_ITEMS: { label: string; free: boolean }[] = [
  { label: "경쟁업체 수", free: true },
  { label: "경쟁강도 등급", free: true },
  { label: "예상 매출 범위", free: false },
  { label: "생존율 분석", free: false },
  { label: "리스크 경고", free: false },
  { label: "맞춤형 창업 전략", free: false },
  { label: "입지 대안 제안", free: false },
];

/** AI 리포트 유도 다이얼로그 */
function ReportUpsellDialog({
  open,
  onClose,
  analysisId,
  competition,
  vitality,
  industryName,
  radius,
}: {
  open: boolean;
  onClose: () => void;
  analysisId: string;
  competition?: CompetitionAnalysis;
  vitality?: VitalityAnalysis;
  industryName: string;
  radius: number;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialVisible, setTestimonialVisible] = useState(true);

  // 3.5초마다 후기 순환
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setTestimonialVisible(false);
      setTimeout(() => {
        setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length);
        setTestimonialVisible(true);
      }, 250);
    }, 3500);
    return () => clearInterval(id);
  }, [open]);

  async function handleGenerate() {
    setIsGenerating(true);
    setGenError(null);
    try {
      const result = await generateReport(analysisId);
      if (result.success) {
        onClose();
        router.push(`/report/${analysisId}`);
      } else {
        setGenError(result.error);
      }
    } catch {
      setGenError("리포트 생성 중 오류가 발생했습니다");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isGenerating && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0 max-h-[90dvh] flex flex-col">
        <div className="overflow-y-auto flex-1">
          {/* ── 상단 타이틀 ── */}
          <div className="px-6 pt-8 pb-5 text-center">
            <DialogHeader>
              <DialogTitle className="text-[22px] font-black leading-[1.4] break-keep">
                <span style={GRADIENT_TEXT_STYLE}>AI 리포트로</span>
                <br />
                <span style={GRADIENT_TEXT_STYLE}>정확한 창업 결정을 내리세요</span>
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* ── 전략 4: 소셜 프루프 — 순환 후기 ── */}
          <div className="px-5 pb-4">
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              {/* 후기 (페이드 전환) */}
              <div
                className="flex items-start gap-3 transition-opacity duration-250"
                style={{ opacity: testimonialVisible ? 1 : 0 }}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=${TESTIMONIALS[testimonialIdx].seed}&backgroundColor=${TESTIMONIALS[testimonialIdx].bg}`}
                    alt="리뷰어 아바타"
                  />
                  <AvatarFallback className="text-xs">
                    {TESTIMONIALS[testimonialIdx].author.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[12px] text-foreground break-keep leading-5">
                    "{TESTIMONIALS[testimonialIdx].text}"
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    — {TESTIMONIALS[testimonialIdx].author}
                  </p>
                </div>
              </div>
              {/* 인디케이터 + 통계 */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  {TESTIMONIALS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === testimonialIdx
                          ? "w-4 bg-violet-500"
                          : "w-1 bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">1,247건</span>
                  <span className="text-[11px] text-amber-500">⭐ 4.7</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 전략 5: 비교 테이블 — 무료 vs AI 리포트 ── */}
          <div className="px-5 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>무료</TableHead>
                  <TableHead className="text-violet-600 dark:text-violet-400">AI 리포트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_ITEMS.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell className={!item.free ? "text-muted-foreground/40" : ""}>
                      {item.free ? "✅" : "🔒"} {item.label}
                    </TableCell>
                    <TableCell className="bg-violet-50 dark:bg-violet-950/20">
                      ✅ {item.label}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ── 전략 3: 가격 앵커링 ── */}
          <div className="px-5 pb-6">
            <div className="rounded-xl bg-muted/50 dark:bg-muted/30 p-4 space-y-1 text-center">
              <p className="text-[12px] text-muted-foreground">
                상권 컨설팅{" "}
                <span className="line-through">50만원</span>
                {" → "}
                <span className="font-bold text-foreground">AI 분석 ₩3,900</span>
              </p>
              <p className="text-[11px] text-muted-foreground break-keep">
                ☕ 아메리카노 한 잔 가격으로 수천만원 투자 리스크를 줄이세요
              </p>
            </div>
          </div>
        </div>

        {/* ── 하단 고정 CTA ── */}
        <div className="shrink-0 px-5 pb-6 pt-3 border-t bg-background">
          {genError && (
            <p className="text-xs text-destructive text-center mb-2">{genError}</p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                리포트 생성 중...
              </>
            ) : (
              "지금 바로 받기 · ₩3,900"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnalysisResult({ data }: AnalysisResultProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // fit-content 상태에서 측정한 초기 콘텐츠 높이 (스냅 복귀 시 사용)
  const contentHeightRef = useRef<number>(0);

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
  const competition = report?.competition as CompetitionAnalysis | undefined;
  const vitality = report?.vitality as VitalityAnalysis | undefined;
  const centerLat = report?.centerLatitude as number | undefined;
  const centerLng = report?.centerLongitude as number | undefined;

  const competitionGrade = competition?.competitionScore?.grade ?? "-";
  const vitalityGrade = vitality?.vitalityScore?.grade ?? "-";

  const insightData = {
    competition: competition ?? null,
    vitality: vitality ?? null,
    places: places ?? null,
    industryName: data.industryName,
    radius: data.radius,
  };
  const competitionInsights = buildCompetitionInsights(insightData);
  const vitalityInsights = buildVitalityInsights(insightData);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* ── 배경 지도 ── */}
      {centerLat && centerLng ? (
        <div className="absolute inset-0 pointer-events-auto">
          <CompetitorMap
            centerLat={centerLat}
            centerLng={centerLng}
            radius={data.radius}
            keyword={data.industryName}
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
        <style dangerouslySetInnerHTML={{ __html: animStyles }} />
        {/* 드래그 핸들 */}
        <div
          ref={handleRef}
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
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
        <div className="flex-1 overflow-y-auto px-4 pb-10 mt-3">
          <Accordion type="multiple" defaultValue={["competition", "vitality"]}>
            {/* 경쟁강도 */}
            <AccordionItem value="competition">
              <AccordionTrigger>
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    경쟁강도
                    <Badge className={BADGE[competitionGrade] ?? BADGE.C}>
                      {competitionGrade}
                    </Badge>
                  </p>
                  <p className="text-[12px] text-muted-foreground font-normal mt-0.5">
                    {COMPETITION_GRADE[competitionGrade] ?? COMPETITION_GRADE.C}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {competitionInsights.length > 0 && (
                  <div className="space-y-0.5">
                    {competitionInsights.map((item, i) => (
                      <Insight key={i} item={item} delay={i * 150} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 상권 활력도 — 데이터 있을 때만 */}
            {vitality && vitalityInsights.length > 0 && (
              <AccordionItem value="vitality">
                <AccordionTrigger>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      상권 활력도
                      <Badge className={BADGE[vitalityGrade] ?? BADGE.C}>
                        {vitalityGrade}
                      </Badge>
                    </p>
                    <p className="text-[12px] text-muted-foreground font-normal mt-0.5">
                      근처 활성화 상권을 찾았어요 · {VITALITY_GRADE[vitalityGrade] ?? VITALITY_GRADE.C}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-0.5">
                    {vitalityInsights.map((item, i) => (
                      <Insight key={i} item={item} delay={i * 150} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

        </div>

        {/* ── 하단 고정 CTA ── */}
        <div className="shrink-0 px-4 pb-3 pt-2 border-t bg-background">
          {data.aiReportJson ? (
            <>
              <p className="text-center text-[11px] text-muted-foreground mb-2 break-keep">
                {dayjs(data.createdAt).format("YYYY년 M월 D일")}에 같은 조건으로 리포트를 받았어요
              </p>
              <Link
                href={`/report/${data.id}`}
                className="flex items-center justify-center gap-1.5 w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-sm transition-transform hover:bg-violet-700 active:scale-95"
              >
                이전에 받은 리포트 보기
                <span className="text-base leading-none">→</span>
              </Link>
            </>
          ) : (
            <>
              <p className="text-center text-[11px] text-muted-foreground mb-2">
                AI가 분석한 맞춤 리포트를 확인해보세요
              </p>
              <button
                type="button"
                onClick={() => setReportDialogOpen(true)}
                className="relative flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-sm transition-transform hover:bg-violet-700 active:scale-95"
              >
                🔒 AI 맞춤 리포트 잠금 해제
              </button>
            </>
          )}
        </div>
      </div>

      <ReportUpsellDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        analysisId={data.id}
        competition={competition}
        vitality={vitality}
        industryName={data.industryName}
        radius={data.radius}
      />
    </div>
  );
}
