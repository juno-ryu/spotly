"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { analysisRequestSchema } from "./schema";
import { runAnalysis } from "./lib/analysis-orchestrator";
import * as kakaoGeocoding from "@/server/data-sources/kakao/client";
import { createSupabaseServer } from "@/server/supabase/server";
import { INDUSTRY_CODES } from "./constants/industry-codes";
import type { AnalysisRequest } from "./schema";
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
  // 기존: vitality !== null (데이터 유무 기반 — 건대입구 등 서울인데 비서울 취급 버그)
  const isSeoul = regionCode.startsWith("11");

  const survivalResult = result.vitality
    ? analyzeSurvival(result.vitality.details.closeRate, result.vitality.details.openRate)
    : null;
  const survival = survivalResult?.survivalScore.score ?? null;

  // 박사님 승인 2026-03-15: subway 이중 반영 방지
  // - 서울: vitality.ts의 analyzeVitality에서 subwayScore를 유동인구에 이미 반영
  //   → calcInfraBonus에 subway=null 전달하여 transit 항목 비활성화
  // - 비서울: vitality 없으므로 subway를 transit으로 infraBonus에서 활용
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
    // 박사님 승인 2026-03-16: 서울 + 골목상권 미반환 구역 (vitality=null) + population 있음
    baseScore = Math.round(competition * 0.55 + population * 0.45);
  } else if (isSeoul && vitality === null && population === null) {
    // 박사님 승인 2026-03-16: 서울 + 데이터 극소 — 신뢰도 경고 필수
    baseScore = competition;
  } else if (isSeoul && population !== null && survival !== null) {
    // 서울: 4대 지표 (infraBonus는 별도 보너스로 가산)
    baseScore = Math.round(
      vitality! * 0.35 + competition * 0.25 + population * 0.20 + survival * 0.20,
    );
  } else if (isSeoul && population !== null && survival === null) {
    // 박사님 승인 2026-03-15: 서울 3지표 (S 없음)
    // survival 0.20을 비례 재배분 → vitality×0.40 + competition×0.30 + population×0.30
    baseScore = Math.round(
      vitality! * 0.40 + competition * 0.30 + population * 0.30,
    );
  } else if (isSeoul && population === null && survival !== null) {
    // 박사님 승인 2026-03-15: 서울 3지표 (P 없음, S 있음)
    baseScore = Math.round(
      vitality! * 0.40 + competition * 0.30 + survival * 0.30,
    );
  } else if (isSeoul && population === null && survival === null) {
    // 박사님 승인 2026-03-15: 서울 2지표 (P, S 모두 없음) — 신뢰도 경고 필수
    baseScore = Math.round(vitality! * 0.55 + competition * 0.45);
  } else if (!isSeoul && population !== null && survival !== null) {
    // 박사님 승인 2026-03-16: 상업지구 population-transit 괴리 보정
    // 비서울에서 population 낮고(≤30) transit 높으면(≥60) 상업지구로 추정, population 상향
    // 이론: Central Place Theory — transit 결절점 = 외부 유입 수요 존재
    let adjustedPopulation = population;
    const transitScore = infraBonus.breakdown.transit ?? 0;
    if (population <= 30 && transitScore >= 60) {
      const gap = transitScore - population;
      const boosted = population + Math.round(gap * 0.5);
      adjustedPopulation = Math.min(boosted, transitScore);
    }
    // 비서울: population 있고 survival도 있는 경우 (방어적 처리)
    baseScore = Math.round(competition * 0.40 + adjustedPopulation * 0.35 + survival * 0.25);
  } else if (!isSeoul && population !== null) {
    // V-01: 비서울 3지표 — infra 접근성을 정규화하여 편입
    // 박사님 승인 2026-03-15: competition×0.45 + population×0.40 + infraAccess×0.15
    // infraAccess: MAX_BONUS(15점) 기준 0~100 정규화

    // 박사님 승인 2026-03-16: 상업지구 population-transit 괴리 보정
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
    // 박사님 승인 2026-03-15: 비서울 2지표 (P 없음) — 신뢰도 경고 필수
    const infraAccess = Math.round((infraBonus.score / 15) * 100);
    baseScore = Math.round(competition * 0.75 + infraAccess * 0.25);
  } else {
    // fallback: competition만 — 신뢰도 경고 필수
    baseScore = competition;
  }

  // 비서울(infraAccess 편입)에서는 infraBonus 이중 반영 방지
  // population null(비서울 2지표)도 infraAccess가 baseScore에 포함되므로 이중 반영 방지 대상
  const isNonSeoulInfraIntegrated = !isSeoul && survival === null;

  // 비서울 infraAccess: infraBonus.score를 0~100으로 정규화 후 등급 부여
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
    survivalResult, // V-10: 이중 호출 제거를 위해 반환
    infraAccessScore,
  };
}

function extractSearchKeywords(industryCode: string, industryName: string): string[] {
  const industry = INDUSTRY_CODES.find((i) => i.code === industryCode);
  if (industry) return [...industry.keywords];
  const keyword = industryName.replace(/전문점|점$/, "") || industryName;
  return [keyword];
}

/** 분석 시작 — 완료까지 기다린 후 결과 페이지로 redirect */
export async function startAnalysis(input: AnalysisRequest) {
  const parsed = analysisRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error("입력값이 올바르지 않습니다");

  // 현재 로그인 유저 조회 (비로그인이면 null)
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // DB에는 사용자 키워드를 industryName으로 저장 (UI 표시용)
  const displayName = parsed.data.industryKeyword || parsed.data.industryName;

  // 주소가 위경도 형태면 역지오코딩으로 실제 주소 변환
  let resolvedAddress = parsed.data.address;
  if (/^\d+\.\d+\s*,\s*\d+\.\d+$/.test(resolvedAddress.trim())) {
    try {
      const region = await kakaoGeocoding.coordToRegion(parsed.data.latitude, parsed.data.longitude);
      resolvedAddress = [region.region1, region.region2, region.region3].filter(Boolean).join(" ");
    } catch {
      // 역지오코딩 실패 시 원본 유지
    }
  }

  const analysis = await prisma.analysisRequest.create({
    data: {
      address: resolvedAddress,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      industryCode: parsed.data.industryCode,
      industryName: displayName,
      radius: parsed.data.radius,
      status: "PROCESSING",
      userId: user?.id ?? null,
    },
  });

  try {
    // districtCode가 있어도 adminDongCode가 없으면 서버 coordToRegion으로 보완
    // (카카오 JS SDK가 지하철역/상업지구 좌표에서 H 타입 미반환하는 버그 우회)
    const region =
      parsed.data.districtCode && parsed.data.adminDongCode
        ? { districtCode: parsed.data.districtCode, code: parsed.data.districtCode + "00000", adminDongCode: parsed.data.adminDongCode }
        : await kakaoGeocoding.coordToRegion(parsed.data.latitude, parsed.data.longitude);

    const aggregated = await runAnalysis({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      regionCode: region.districtCode,
      industryKeywords: extractSearchKeywords(parsed.data.industryCode, parsed.data.industryName),
      industryCode: parsed.data.industryCode,
      industryName: parsed.data.industryName,
      industryKeyword: parsed.data.industryKeyword,
      radius: parsed.data.radius,
      // 서버 coordToRegion 결과 우선, 없으면 클라이언트 전달값 사용
      adminDongCode: region.adminDongCode ?? parsed.data.adminDongCode,
      dongName: parsed.data.dongName,
    });

    const { total: totalScore, infraBonus, survivalResult, infraAccessScore } = calcTotalScore(aggregated, parsed.data.industryName, region.districtCode);

    await prisma.analysisRequest.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        regionCode: region.code,
        totalScore,
        scoreDetail: JSON.parse(JSON.stringify({
          competition: aggregated.competition.competitionScore,
          vitality: aggregated.vitality?.vitalityScore ?? null,
          population: aggregated.populationAnalysis?.score ?? null,
          // V-10: survivalResult 재사용 (calcTotalScore에서 이미 계산된 값)
          survival: survivalResult?.survivalScore ?? null,
          // 비서울 전용: infraBonus.score를 0~100 정규화한 인프라 접근성 지표
          infraAccess: infraAccessScore,
          infraBonus,
        })),
        reportData: JSON.parse(JSON.stringify(aggregated)),
      },
    });
  } catch (error) {
    console.error(`분석 실패 [${analysis.id}]:`, error);
    await prisma.analysisRequest.update({
      where: { id: analysis.id },
      data: { status: "FAILED" },
    });
  }

  redirect(`/analyze/${analysis.id}`);
}
