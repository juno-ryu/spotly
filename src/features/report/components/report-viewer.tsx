"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState, useEffect } from "react";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  RadarChart,
  Radar,
  PolarGrid,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { AiReport } from "../schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import { GRADE_HEX, GRADE_BG } from "@/features/analysis/lib/grade";
import { ScoreMetricCards } from "./score-metric-cards";
import { RiskWarningsList } from "./risk-warnings-list";
import { PopulationInsightCard } from "./population-insight-card";
import { InfrastructureInsightCard } from "./infrastructure-insight-card";
import { DetailedAnalysisTabs } from "./detailed-analysis-tabs";
import { CompetitionChart } from "./competition-chart";
import { ReportBottomCTA } from "./report-bottom-cta";

interface ReportViewerProps {
  report: AiReport;
  totalScore?: number;
  scoreGrade?: string;
  scoreDetail?: ScoreBreakdown;
  /** 공유용 데이터 */
  shareTitle?: string;
  shareText?: string;
  reportUrl?: string;
  imageUrl?: string;
  /** 좌표 (연관 업종 재분석용) */
  lat?: number | null;
  lng?: number | null;
  address?: string;
  industryName?: string;
}

export function ReportViewer({
  report,
  totalScore = 0,
  scoreGrade = "C",
  scoreDetail,
  shareTitle,
  shareText,
  reportUrl,
  imageUrl,
  lat,
  lng,
  address,
  industryName,
}: ReportViewerProps) {
  const gradeColor = GRADE_HEX[scoreGrade as keyof typeof GRADE_HEX] ?? "#6b7280";

  /** SSR hydration 에러 방지 — Recharts SVG ID 불일치 우회 */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);


  /** RadarChart 데이터 — 없는 지표는 0점으로 채워 최소 3축 보장 */
  const radarData = scoreDetail
    ? [
        { subject: "경쟁", score: scoreDetail.competition?.score ?? 0 },
        { subject: "인구", score: scoreDetail.population?.score ?? 0 },
        { subject: "활력", score: scoreDetail.vitality?.score ?? 0 },
        { subject: "생존", score: scoreDetail.survival?.score ?? 0 },
        { subject: "인프라", score: scoreDetail.infraAccess?.score ?? 0 },
      ].filter((d) => d.score > 0 || true)
    : [];

  const showRadar = radarData.length >= 3;

  return (
    <div className="space-y-6 px-2 pt-4">
      {/* ── 종합 판단 ── */}
      <div className="px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* 차트: 도넛 + 레이더 (모바일: 가로 나란히, 데스크톱: 가로 나란히) */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            {/* 종합 점수 Radial Chart */}
            <div className="relative h-[140px] w-[140px] shrink-0">
              {mounted ? (
                <ChartContainer
                  config={{ score: { label: "종합", color: gradeColor } } satisfies ChartConfig}
                  className="h-full w-full"
                >
                  <RadialBarChart
                    data={[{ score: totalScore, fill: gradeColor }]}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={48}
                    outerRadius={65}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                    <RadialBar dataKey="score" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
                  </RadialBarChart>
                </ChartContainer>
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black" style={{ color: gradeColor }}>
                  {scoreGrade}
                </span>
                <span className="text-xs text-muted-foreground">{totalScore}/100</span>
              </div>
            </div>

            {/* 지표 차트 — 3개 이상: 레이더, 2개: 바 차트 */}
            {mounted && showRadar && (
              <div className="flex items-center justify-center shrink-0 w-[180px] h-[180px]">
                <RadarChart width={180} height={180} data={radarData} cx="50%" cy="50%" outerRadius={55}>
                  <PolarGrid stroke="#d1d5db" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Radar dataKey="score" fill={gradeColor} fillOpacity={0.25} stroke={gradeColor} strokeWidth={1.5} />
                </RadarChart>
              </div>
            )}

          </div>

          {/* 텍스트 — 모바일: 차트 아래, 데스크톱: 차트 옆 */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">종합평가</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${GRADE_BG[scoreGrade as keyof typeof GRADE_BG] ?? ""}`}
              >
                {scoreGrade}등급
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {report.verdict}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{report.analysisScope}</p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* ── 스코어링 지표 카드 그리드 ── */}
      {scoreDetail && (
        <div className="px-4">
          <ScoreMetricCards scoreDetail={scoreDetail} />
        </div>
      )}

      {/* ── 아코디언 ── */}
      <Accordion
        type="multiple"
        defaultValue={["competition", "revenue", "survival", "population", "infra", "risk", "strategy", "location", "detail"]}
      >
        {/* ── 경쟁 환경 ── */}
        {report.competitionGrade && (
          <AccordionItem value="competition" className="border-none px-4">
            <AccordionTrigger className="hover:no-underline py-4 items-start">
              <div className="flex items-start gap-2 text-left">
                <span>⚔️</span>
                <span className="font-semibold text-sm">{report.competitionGrade.label}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BG[report.competitionGrade.grade as keyof typeof GRADE_BG] ?? ""}`}>
                  {report.competitionGrade.grade}등급
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              {report.competitorCount ? (
                <CompetitionChart
                  competitorCount={report.competitorCount}
                  competitionGrade={report.competitionGrade}
                />
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {report.competitionGrade.rationale}
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        <Separator />

        {/* ── 매출 분석 ── */}
        {report.revenueEstimate && (
          <>
            <AccordionItem value="revenue" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>💰</span>
                  <span className="font-semibold text-sm">
                    점포당 월 평균 {(report.revenueEstimate.monthlyPerStoreMaan ?? 0).toLocaleString()}만원
                  </span>
                  {scoreDetail?.vitality && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BG[scoreDetail.vitality.grade as keyof typeof GRADE_BG] ?? ""}`}>
                      {scoreDetail.vitality.grade}등급
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="space-y-4 text-sm">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{(report.revenueEstimate.monthlyPerStoreMaan ?? 0).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm">만원 / 월 (점포당)</span>
                  </div>
                  <div className="space-y-1.5 text-muted-foreground text-xs">
                    <p>⏰ 피크: {report.revenueEstimate.peakTimeSlot} · 👥 주 소비층: {report.revenueEstimate.mainAgeGroup}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.revenueEstimate.interpretation}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    서울시 골목상권 카드매출 기준 · {report.revenueEstimate.storeCount ?? 0}개 점포 평균{(report.revenueEstimate.storeCount ?? 0) < 5 ? " · 점포 수가 적어 평균값이 왜곡될 수 있습니다" : ""}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 폐업률·개업률 ── */}
        {report.survivalAnalysis && (
          <>
            <AccordionItem value="survival" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>📊</span>
                  <span className="font-semibold text-sm">
                    폐업률 {report.survivalAnalysis.closeRate}% · 개업률 {report.survivalAnalysis.openRate}%
                  </span>
                  {scoreDetail?.survival && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BG[scoreDetail.survival.grade as keyof typeof GRADE_BG] ?? ""}`}>
                      {scoreDetail.survival.grade}등급
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="space-y-4 text-sm">
                  {mounted && <ChartContainer
                    config={{ value: { label: "비율" } } satisfies ChartConfig}
                    className="h-[80px] w-full"
                  >
                    <BarChart
                      data={[
                        { name: "폐업률", value: report.survivalAnalysis.closeRate },
                        { name: "개업률", value: report.survivalAnalysis.openRate },
                      ]}
                      layout="vertical"
                      margin={{ left: 50, right: 30, top: 5, bottom: 5 }}
                    >
                      <XAxis type="number" domain={[0, Math.max(report.survivalAnalysis.closeRate, report.survivalAnalysis.openRate, 10)]} tickFormatter={(v) => `${v}%`} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={45} fontSize={11} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                        <Cell fill={report.survivalAnalysis.isHighCloseRate ? "#ef4444" : "#22c55e"} />
                        <Cell fill="#3b82f6" />
                      </Bar>
                    </BarChart>
                  </ChartContainer>}
                  <p className="text-[10px] text-muted-foreground">기준: 폐업률 5% 초과 시 주의</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.survivalAnalysis.interpretation}</p>
                  <p className="text-[10px] text-muted-foreground/60">출처: {report.survivalAnalysis.dataSource}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 배후 인구 ── */}
        {report.populationInsight && (
          <>
            <AccordionItem value="population" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>👥</span>
                  <span className="font-semibold text-sm">{report.populationInsight.headline}</span>
                  {scoreDetail?.population && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BG[scoreDetail.population.grade as keyof typeof GRADE_BG] ?? ""}`}>
                      {scoreDetail.population.grade}등급
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                {scoreDetail?.population ? (
                  <PopulationInsightCard
                    populationScore={scoreDetail.population}
                    headline={report.populationInsight.headline}
                    body={report.populationInsight.body}
                    exteriorDependencyPercent={report.populationInsight.exteriorDependencyPercent}
                    exteriorDependencyLabel={report.populationInsight.exteriorDependencyLabel}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.populationInsight.body}</p>
                )}
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 주변 인프라 ── */}
        {report.infrastructureInsight && (
          <>
            <AccordionItem value="infra" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>🏙️</span>
                  <span className="font-semibold text-sm">{report.infrastructureInsight.headline}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <InfrastructureInsightCard
                  body={report.infrastructureInsight.body}
                  infraAccess={scoreDetail?.infraAccess}
                />
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 리스크 경고 ── */}
        {report.riskWarnings && report.riskWarnings.length > 0 && (
          <>
            <AccordionItem value="risk" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>🚨</span>
                  <span className="font-semibold text-sm">리스크 경고</span>
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{report.riskWarnings!.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <RiskWarningsList riskWarnings={report.riskWarnings!} />
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 맞춤형 전략 ── */}
        {report.strategy && (
          <AccordionItem value="strategy" className="border-none px-4">
            <AccordionTrigger className="hover:no-underline py-4 items-start">
              <div className="flex items-start gap-2 text-left">
                <span>🎯</span>
                <span className="font-semibold text-sm">맞춤형 창업 전략</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6 space-y-4 text-sm">
              {/* 전략 카드 3열 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>🎯</span>
                    <span className="text-[10px] font-medium">포지셔닝</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{report.strategy.positioning}</p>
                </div>
                <div className="rounded-lg border bg-card p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>👥</span>
                    <span className="text-[10px] font-medium">타겟 고객</span>
                  </div>
                  <p className="text-sm font-medium">{report.strategy.targetCustomer}</p>
                </div>
                {report.strategy.recommendedHours && (
                  <div className="rounded-lg border bg-card p-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span>⏰</span>
                      <span className="text-[10px] font-medium">추천 운영 시간</span>
                    </div>
                    <p className="text-sm font-medium">{report.strategy.recommendedHours}</p>
                  </div>
                )}
              </div>
              {/* 실행 항목 — 번호 + 체크리스트 스타일 */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-[10px] text-muted-foreground font-medium mb-3">📋 실행 항목</p>
                <ul className="space-y-2.5">
                  {report.strategy.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}>{i + 1}</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <Separator />

        {/* ── 입지 활용 전략 ── */}
        {report.locationAdvice && (
          <AccordionItem value="location" className="border-none px-4">
            <AccordionTrigger className="hover:no-underline py-4 items-start">
              <div className="flex items-start gap-2 text-left">
                <span>📍</span>
                <span className="font-semibold text-sm">입지 활용 전략</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6 space-y-4 text-sm">
              <p className="text-xs text-muted-foreground leading-relaxed">{report.locationAdvice.currentAssessment}</p>
              <ul className="space-y-3">
                {report.locationAdvice.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">●</span>
                    <div className="leading-relaxed">
                      <span className="font-medium">{s.direction}</span>
                      <span className="text-muted-foreground"> — {s.rationale}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        <Separator />

        {/* ── 상세 분석 (탭 분할) ── */}
        <AccordionItem value="detail" className="border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4 items-start">
            <div className="flex items-start gap-2 text-left">
              <span>📝</span>
              <span className="font-semibold text-sm">상세 분석</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <DetailedAnalysisTabs detailedAnalysis={report.detailedAnalysis} gradeColor={gradeColor} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ── 법적 면책 ── */}
      <div className="px-4 py-4 rounded-lg bg-muted/50 mx-2">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">⚠️ 필수 확인</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          이 리포트는 서울시 골목상권 정보시스템, KOSIS 인구 통계, 카카오 Places, 서울교통공사 통계 등 공공·민간 데이터를 기반으로 한 참고 자료이며, 개인의 창업 판단에 도움을 줄뿐, 최종 결정 전 반드시 현장 답사(특히 운영 시간대별 유동인구, 기존 경쟁사 방문)와 전문가 상담을 병행하세요.
        </p>
      </div>

      {/* ── 하단 CTA (공유 + 연관 업종) ── */}
      {reportUrl && (
        <ReportBottomCTA
          shareTitle={shareTitle ?? ""}
          shareText={shareText ?? ""}
          reportUrl={reportUrl}
          imageUrl={imageUrl}
          industryName={industryName ?? ""}
          relatedIndustries={report.relatedIndustries}
          lat={lat}
          lng={lng}
          address={address ?? ""}
        />
      )}
    </div>
  );
}
