"use server";

import { runAnalysis } from "./lib/analysis-orchestrator";
import * as kakaoGeocoding from "@/server/data-sources/kakao/client";

import { INDUSTRY_CODES } from "./constants/industry-codes";
import type { AnalysisResult } from "./lib/analysis-orchestrator";
import { analyzeSurvival } from "./lib/scoring";
import { calcInfraBonus, type InfraBonusResult } from "./lib/scoring/infra-bonus";
import type { SurvivalAnalysis } from "./lib/scoring/survival";
import { scoreToGrade } from "./lib/scoring/types";

/**
 * 4대 지표 가중 합산으로 totalScore 계산
 *
 * 서울 (골목상권 데이터 있음):
 *   vitality × 0.35 + competition × 0.25 + population × 0.20 + survival × 0.20
 *
 * 비서울 (골목상권 없음, vitality null):
 *   - survival도 있으면: competition × 0.40 + population × 0.35 + survival × 0.25
 *   - survival도 없으면: competition × 0.55 + population × 0.45
 */
function calcTotalScore(
  result: AnalysisResult,
  industryName: string,
  regionCode: string,
): { total: number; infraBonus: InfraBonusResult; survivalResult: SurvivalAnalysis | null; infraAccessScore: { score: number; grade: string; gradeLabel: string } | null } {
  const competition = result.competition.competitionScore.score;
  const vitality = result.vitality?.vitalityScore.score ?? null;
  const population = result.populationAnalysis?.score.score ?? null;

  // 박사님 승인 2026-03-16: isSeoul을 지리 기반으로 통일
  const isSeoul = regionCode.startsWith("11");

  const survivalResult = result.vitality
    ? analyzeSurvival(result.vitality.details.closeRate, result.vitality.details.openRate)
    : null;
  const survival = survivalResult?.survivalScore.score ?? null;

  // 박사님 승인 2026-03-15: subway 이중 반영 방지
  const infraBonus = calcInfraBonus({
    bus: result.bus ?? null,
    school: result.school ?? null,
    university: result.university ?? null,
    medical: result.medical ?? null,
    industryName,
    subway: isSeoul ? null : (result.subway ?? null),
  });

  let baseScore: number;
  if (isSeoul && vitality === null && population !== null) {
    baseScore = Math.round(competition * 0.55 + population * 0.45);
  } else if (isSeoul && vitality === null && population === null) {
    baseScore = competition;
  } else if (isSeoul && population !== null && survival !== null) {
    baseScore = Math.round(
      vitality! * 0.35 + competition * 0.25 + population * 0.20 + survival * 0.20,
    );
  } else if (isSeoul && population !== null && survival === null) {
    baseScore = Math.round(
      vitality! * 0.40 + competition * 0.30 + population * 0.30,
    );
  } else if (isSeoul && population === null && survival !== null) {
    baseScore = Math.round(
      vitality! * 0.40 + competition * 0.30 + survival * 0.30,
    );
  } else if (isSeoul && population === null && survival === null) {
    baseScore = Math.round(vitality! * 0.55 + competition * 0.45);
  } else if (!isSeoul && population !== null && survival !== null) {
    let adjustedPopulation = population;
    const transitScore = infraBonus.breakdown.transit ?? 0;
    if (population <= 30 && transitScore >= 60) {
      const gap = transitScore - population;
      const boosted = population + Math.round(gap * 0.5);
      adjustedPopulation = Math.min(boosted, transitScore);
    }
    baseScore = Math.round(competition * 0.40 + adjustedPopulation * 0.35 + survival * 0.25);
  } else if (!isSeoul && population !== null) {
    let adjustedPopulation = population;
    const transitScore = infraBonus.breakdown.transit ?? 0;
    if (population <= 30 && transitScore >= 60) {
      const gap = transitScore - population;
      const boosted = population + Math.round(gap * 0.5);
      adjustedPopulation = Math.min(boosted, transitScore);
    }
    const infraAccess = Math.round((infraBonus.score / 15) * 100);
    baseScore = Math.round(
      competition * 0.45 + adjustedPopulation * 0.40 + infraAccess * 0.15,
    );
  } else if (!isSeoul && population === null) {
    const infraAccess = Math.round((infraBonus.score / 15) * 100);
    baseScore = Math.round(competition * 0.75 + infraAccess * 0.25);
  } else {
    baseScore = competition;
  }

  const isNonSeoulInfraIntegrated = !isSeoul && survival === null;

  const infraAccessScore = isNonSeoulInfraIntegrated
    ? (() => {
        const normalized = Math.round((infraBonus.score / 15) * 100);
        const { grade, gradeLabel } = scoreToGrade(normalized);
        return { score: normalized, grade, gradeLabel };
      })()
    : null;

  return {
    total: isNonSeoulInfraIntegrated
      ? Math.min(100, baseScore)
      : Math.min(100, baseScore + infraBonus.score),
    infraBonus,
    survivalResult,
    infraAccessScore,
  };
}

function extractSearchKeywords(industryCode: string, industryName: string): string[] {
  const industry = INDUSTRY_CODES.find((i) => i.code === industryCode);
  if (industry) return [...industry.keywords];
  const keyword = industryName.replace(/전문점|점$/, "") || industryName;
  return [keyword];
}

/** searchParams 기반 분석 입력 */
export interface AnalyzeParams {
  lat: number;
  lng: number;
  address: string;
  code: string;
  keyword: string;
  radius: number;
}

/** 분석 실행 — 서버 컴포넌트에서 호출. DB 저장 없이 결과만 반환 */
export async function executeAnalysis(params: AnalyzeParams) {
  const industry = INDUSTRY_CODES.find((i) => i.code === params.code);
  const industryName = industry?.name ?? params.keyword;

  const region = await kakaoGeocoding.coordToRegion(params.lat, params.lng);

  const aggregated = await runAnalysis({
    latitude: params.lat,
    longitude: params.lng,
    regionCode: region.districtCode,
    industryKeywords: extractSearchKeywords(params.code, industryName),
    industryCode: params.code,
    industryName,
    industryKeyword: params.keyword,
    radius: params.radius,
    adminDongCode: region.adminDongCode,
    dongName: undefined,
  });

  const { total: totalScore, infraBonus, survivalResult, infraAccessScore } =
    calcTotalScore(aggregated, industryName, region.districtCode);

  const scoreDetail = {
    competition: aggregated.competition.competitionScore,
    vitality: aggregated.vitality?.vitalityScore ?? null,
    population: aggregated.populationAnalysis?.score ?? null,
    survival: survivalResult?.survivalScore ?? null,
    infraAccess: infraAccessScore,
    infraBonus,
  };

  return {
    address: params.address,
    industryName,
    industryKeyword: params.keyword,
    radius: params.radius,
    totalScore,
    scoreDetail,
    isSeoul: region.districtCode.startsWith("11"),
    // 지도 + 인프라 데이터 (클라이언트 렌더링용)
    centerLatitude: params.lat,
    centerLongitude: params.lng,
    competition: aggregated.competition,
    vitality: aggregated.vitality ?? null,
    populationAnalysis: aggregated.populationAnalysis ?? null,
    places: aggregated.places ?? null,
    subway: aggregated.subway ?? null,
    bus: aggregated.bus ?? null,
    school: aggregated.school ?? null,
    university: aggregated.university ?? null,
    medical: aggregated.medical ?? null,
  };
}

/** executeAnalysis 반환 타입 */
export type AnalysisData = Awaited<ReturnType<typeof executeAnalysis>>;
