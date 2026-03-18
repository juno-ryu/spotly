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
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { AiReport } from "../schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";

interface ReportViewerProps {
  report: AiReport;
  totalScore?: number;
  scoreGrade?: string;
  scoreDetail?: ScoreBreakdown;
}

/** 등급 → 색상 hex (프로젝트 컬러 체계) */
const GRADE_COLOR: Record<string, string> = {
  A: "#10b981",
  B: "#8b5cf6",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};

/** 등급별 Badge 색상 클래스 */
const GRADE_BADGE_CLASS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  B: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  C: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  D: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  F: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

export function ReportViewer({
  report,
  totalScore = 0,
  scoreGrade = "C",
  scoreDetail,
}: ReportViewerProps) {
  const gradeColor = GRADE_COLOR[scoreGrade] ?? "#6b7280";
  const competitionColor = GRADE_COLOR[report.competitionGrade?.grade ?? "C"] ?? "#6b7280";

  return (
    <div className="space-y-6 px-2">
      {/* ── 종합 판단 ── */}
      <div className="px-4 mt-4">
        <div className="flex items-start gap-5">
          {/* 종합 점수 Radial Chart */}
          <div className="relative h-[100px] w-[100px] shrink-0">
            <ChartContainer
              config={{ score: { label: "종합", color: gradeColor } } satisfies ChartConfig}
              className="h-full w-full"
            >
              <RadialBarChart
                data={[{ score: totalScore, fill: gradeColor }]}
                startAngle={90}
                endAngle={-270}
                innerRadius={35}
                outerRadius={48}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <RadialBar dataKey="score" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
              </RadialBarChart>
            </ChartContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black" style={{ color: gradeColor }}>
                {scoreGrade}
              </span>
              <span className="text-[9px] text-muted-foreground">{totalScore}/100</span>
            </div>
          </div>
          {/* 텍스트 */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground">종합평가</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${GRADE_BADGE_CLASS[scoreGrade] ?? ""}`}
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

      {/* ── 스코어링 지표 요약 ── */}
      {scoreDetail && (
        <div className="px-4 flex flex-wrap gap-3 text-xs">
          {scoreDetail.competition && (
            <div className="flex items-start gap-1">
              <span>🏪</span>
              <span className="text-muted-foreground">경쟁</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_BADGE_CLASS[scoreDetail.competition.grade] ?? ""}`}>
                {scoreDetail.competition.grade}
              </Badge>
            </div>
          )}
          {scoreDetail.vitality && (
            <div className="flex items-start gap-1">
              <span>📈</span>
              <span className="text-muted-foreground">활력</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_BADGE_CLASS[scoreDetail.vitality.grade] ?? ""}`}>
                {scoreDetail.vitality.grade}
              </Badge>
            </div>
          )}
          {scoreDetail.population && (
            <div className="flex items-start gap-1">
              <span>👥</span>
              <span className="text-muted-foreground">인구</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_BADGE_CLASS[scoreDetail.population.grade] ?? ""}`}>
                {scoreDetail.population.grade}
              </Badge>
            </div>
          )}
          {scoreDetail.survival && (
            <div className="flex items-start gap-1">
              <span>📊</span>
              <span className="text-muted-foreground">생존</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_BADGE_CLASS[scoreDetail.survival.grade] ?? ""}`}>
                {scoreDetail.survival.grade}
              </Badge>
            </div>
          )}
          {scoreDetail.infraAccess && (
            <div className="flex items-start gap-1">
              <span>🏗️</span>
              <span className="text-muted-foreground">인프라</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_BADGE_CLASS[scoreDetail.infraAccess.grade] ?? ""}`}>
                {scoreDetail.infraAccess.grade}
              </Badge>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* ── 아코디언 ── */}
      <Accordion
        type="multiple"
        defaultValue={["competition", "revenue", "survival", "population", "infra", "risk", "strategy", "location", "detail"]}
      >
        {/* ── 경쟁 환경 (스코어링 포함) ── */}
        {report.competitionGrade && (
        <AccordionItem value="competition" className="border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4 items-start">
            <div className="flex items-start gap-2 text-left">
              <span>⚔️</span>
              <span className="font-semibold text-sm">{report.competitionGrade.label}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BADGE_CLASS[report.competitionGrade.grade] ?? ""}`}>
                {report.competitionGrade.grade}등급
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4">
            {report.competitorCount && (
            <div className="space-y-2 text-sm">
              <p>● 직접 경쟁 <strong>{report.competitorCount.direct}개</strong> · 간접 {report.competitorCount.indirect}개</p>
              {report.competitorCount.franchise > 0 && (
                <p className="text-muted-foreground pl-4">🏢 프랜차이즈 {report.competitorCount.franchise}개</p>
              )}
            </div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">{report.competitionGrade.rationale}</p>
            {report.competitorCount && (
              <p className="text-xs text-muted-foreground">{report.competitorCount.interpretation}</p>
            )}
          </AccordionContent>
        </AccordionItem>
        )}

        <Separator />

        {/* ── 매출 분석 (데이터 있을 때만) ── */}
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
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BADGE_CLASS[scoreDetail.vitality.grade] ?? ""}`}>
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

        {/* ── 폐업률·개업률 (데이터 있을 때만) ── */}
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
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BADGE_CLASS[scoreDetail.survival.grade] ?? ""}`}>
                      {scoreDetail.survival.grade}등급
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="space-y-4 text-sm">
                  <ChartContainer
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
                  </ChartContainer>
                  <p className="text-[10px] text-muted-foreground">기준: 폐업률 5% 초과 시 주의</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.survivalAnalysis.interpretation}</p>
                  <p className="text-[10px] text-muted-foreground/60">출처: {report.survivalAnalysis.dataSource}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 배후 인구 (AI 응답) ── */}
        {report.populationInsight && (
          <>
            <AccordionItem value="population" className="border-none px-4">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex items-start gap-2 text-left">
                  <span>👥</span>
                  <span className="font-semibold text-sm">{report.populationInsight.headline}</span>
                  {scoreDetail?.population && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${GRADE_BADGE_CLASS[scoreDetail.population.grade] ?? ""}`}>
                      {scoreDetail.population.grade}등급
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <p className="text-xs text-muted-foreground leading-relaxed">{report.populationInsight.body}</p>
              </AccordionContent>
            </AccordionItem>
            <Separator />
          </>
        )}

        {/* ── 주변 인프라 (AI 응답) ── */}
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
                <p className="text-xs text-muted-foreground leading-relaxed">{report.infrastructureInsight.body}</p>
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
              <AccordionContent className="pb-6 space-y-4">
                {report.riskWarnings!.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5">
                        <Badge
                          variant={risk.severity === "위험" ? "destructive" : "outline"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {risk.severity}
                        </Badge>
                        <span className="text-sm font-medium">{risk.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{risk.detail}</p>
                    </div>
                  </div>
                ))}
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
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">포지셔닝</p>
              <p className="font-medium leading-relaxed">{report.strategy.positioning}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">타겟 고객</p>
              <p className="font-medium">{report.strategy.targetCustomer}</p>
            </div>
            {report.strategy.recommendedHours && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">추천 운영 시간</p>
                <p className="font-medium">{report.strategy.recommendedHours}</p>
              </div>
            )}
            <Separator />
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">실행 항목</p>
              <ul className="space-y-2">
                {report.strategy.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground mt-0.5 shrink-0">●</span>
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

        {/* ── 상세 분석 ── */}
        <AccordionItem value="detail" className="border-none px-4">
          <AccordionTrigger className="hover:no-underline py-4 items-start">
            <div className="flex items-start gap-2 text-left">
              <span>📝</span>
              <span className="font-semibold text-sm">상세 분석</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {report.detailedAnalysis}
            </div>
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

    </div>
  );
}
