"use client";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import type { IndicatorGrade } from "@/features/analysis/lib/grade";

interface MetricCardsProps {
  scoreDetail: ScoreBreakdown | undefined;
  reportData: Record<string, unknown> | undefined;
  isSeoul: boolean;
}

/** 지표 등급별 Badge 색상 */
const METRIC_BADGE_CLASS: Record<IndicatorGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  B: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  C: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  D: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  F: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

/** 등급별 이모지 원 배경색 */
const GRADE_EMOJI_BG: Record<IndicatorGrade, string> = {
  A: "bg-emerald-100 dark:bg-emerald-950/40",
  B: "bg-violet-100 dark:bg-violet-950/40",
  C: "bg-amber-100 dark:bg-amber-950/40",
  D: "bg-orange-100 dark:bg-orange-950/40",
  F: "bg-red-100 dark:bg-red-950/40",
};

interface MetricItem {
  icon: string;
  label: string;
  grade: IndicatorGrade;
  fact: string | null;
}

function getCompetitionFact(reportData: Record<string, unknown> | undefined): string | null {
  const places = reportData?.places as { totalCount?: number } | undefined;
  if (places?.totalCount === 0) return "경쟁업체 미발견 · 중립 점수 부여";
  if (places?.totalCount != null) return `동종 ${places.totalCount}곳 · Kakao Places`;
  return null;
}

function getVitalityFact(reportData: Record<string, unknown> | undefined): string | null {
  const vitality = reportData?.vitality as
    | { details?: { floatingPopulation?: { totalFloating?: number } } }
    | undefined;
  const totalFloating = vitality?.details?.floatingPopulation?.totalFloating;
  if (totalFloating != null && totalFloating > 0) {
    if (totalFloating >= 10_000) {
      const man = (totalFloating / 10_000).toFixed(1).replace(/\.0$/, "");
      return `유동인구 분기 ${man}만명 · 서울 골목상권`;
    }
    return `유동인구 분기 ${totalFloating.toLocaleString()}명 · 서울 골목상권`;
  }
  return null;
}

function getPopulationFact(reportData: Record<string, unknown> | undefined): string | null {
  const population = reportData?.populationAnalysis as
    | { details?: { totalPopulation?: number }; isDongLevel?: boolean }
    | undefined;
  const totalPop = population?.details?.totalPopulation;
  if (totalPop == null || totalPop <= 0) return null;
  const level = population?.isDongLevel ? "읍면동 기준" : "시군구 기준";
  return `배후인구 ${totalPop.toLocaleString()}명 · KOSIS (${level})`;
}

function getSurvivalFact(reportData: Record<string, unknown> | undefined): string | null {
  const vitality = reportData?.vitality as
    | { details?: { closeRate?: number; openRate?: number } }
    | undefined;
  const closeRate = vitality?.details?.closeRate;
  const openRate = vitality?.details?.openRate;
  if (closeRate != null && openRate != null) {
    return `폐업률 ${closeRate.toFixed(1)}% · 개업률 ${openRate.toFixed(1)}% · 서울 골목상권`;
  }
  return null;
}

function getInfraAccessFact(reportData: Record<string, unknown> | undefined): string | null {
  const bus = reportData?.bus as { totalRouteCount?: number } | null | undefined;
  const subway = reportData?.subway as { stationsInRadius?: unknown[] } | null | undefined;
  const school = reportData?.school as { totalCount?: number } | null | undefined;
  const medical = reportData?.medical as { count?: number } | null | undefined;

  const parts: string[] = [];
  if (bus?.totalRouteCount != null && bus.totalRouteCount > 0) parts.push(`버스 ${bus.totalRouteCount}노선`);
  if (subway?.stationsInRadius != null && subway.stationsInRadius.length > 0) parts.push(`지하철 ${subway.stationsInRadius.length}역`);
  if (school?.totalCount != null && school.totalCount > 0) parts.push(`학교 ${school.totalCount}곳`);
  if (medical?.count != null && medical.count > 0) parts.push(`의료 ${medical.count}곳`);

  if (parts.length > 0) return parts.join(" · ");
  return null;
}

/** shadcn Item 기반 지표 목록 */
export function MetricCards({ scoreDetail, reportData, isSeoul }: MetricCardsProps) {
  if (!scoreDetail) return null;

  const items: MetricItem[] = [];

  const competitionFact = getCompetitionFact(reportData);
  if (competitionFact !== null) {
    items.push({
      icon: "🏪",
      label: "경쟁",
      grade: (scoreDetail.competition?.grade ?? "C") as IndicatorGrade,
      fact: competitionFact,
    });
  }

  if (isSeoul && scoreDetail.vitality) {
    const vitalityFact = getVitalityFact(reportData);
    if (vitalityFact !== null) {
      items.push({
        icon: "📈",
        label: "활력도",
        grade: scoreDetail.vitality.grade as IndicatorGrade,
        fact: vitalityFact,
      });
    }
  }

  const populationFact = getPopulationFact(reportData);
  if (populationFact !== null) {
    items.push({
      icon: "👥",
      label: "인구",
      grade: (scoreDetail.population?.grade ?? "C") as IndicatorGrade,
      fact: populationFact,
    });
  }

  // 서울 전용: 생존율 (서울 골목상권 기반)
  if (isSeoul && scoreDetail.survival) {
    const survivalFact = getSurvivalFact(reportData);
    if (survivalFact !== null) {
      items.push({
        icon: "📊",
        label: "생존율",
        grade: scoreDetail.survival.grade as IndicatorGrade,
        fact: survivalFact,
      });
    }
  }

  // 비서울 전용: 인프라 접근성 (infraBonus 정규화)
  if (!isSeoul && scoreDetail.infraAccess) {
    const infraFact = getInfraAccessFact(reportData);
    if (infraFact !== null) {
      items.push({
        icon: "🏗️",
        label: "인프라",
        grade: scoreDetail.infraAccess.grade as IndicatorGrade,
        fact: infraFact,
      });
    }
  }

  // 신뢰도 경고 수집 — 데이터 수집 자체가 실패한 경우만 경고 (업종 특성상 없는 건 정상)
  const warnings: string[] = [];
  if (!reportData?.places) warnings.push("주변 상권 정보를 조회하지 못해 경쟁 분석 신뢰도가 낮습니다");
  if (!reportData?.populationAnalysis) warnings.push("KOSIS 인구 데이터를 조회하지 못해 인구 분석 신뢰도가 낮습니다");

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <Item key={item.label} variant="outline" size="sm">
          <ItemMedia>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${GRADE_EMOJI_BG[item.grade]}`}>
              {item.icon}
            </div>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{item.label}</ItemTitle>
            <ItemDescription>{item.fact}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold px-2 py-0 ${METRIC_BADGE_CLASS[item.grade]}`}
            >
              {item.grade}등급
            </Badge>
          </ItemActions>
        </Item>
      ))}
      {warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {warnings.map((w) => (
            <p key={w} className="text-xs text-muted-foreground">⚠️ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
