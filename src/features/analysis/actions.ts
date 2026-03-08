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
): { total: number; infraBonus: InfraBonusResult; survivalResult: SurvivalAnalysis | null } {
  const competition = result.competition.competitionScore.score;
  const vitality = result.vitality?.vitalityScore.score ?? null;
  const population = result.populationAnalysis?.score.score ?? null;

  // 서울 판단: vitality(골목상권 API) 데이터 존재 = 서울 체계
  // 하남·과천 등 경기 접경 지역은 골목상권 데이터 없음 → 자동으로 비서울 체계 (V-04)
  const survivalResult = result.vitality
    ? analyzeSurvival(result.vitality.details.closeRate, result.vitality.details.openRate)
    : null;
  const survival = survivalResult?.survivalScore.score ?? null;

  // infraBonus를 먼저 계산 (비서울 체계에서 baseScore에 편입, V-01)
  const infraBonus = calcInfraBonus({
    bus: result.bus ?? null,
    school: result.school ?? null,
    university: result.university ?? null,
    medical: result.medical ?? null,
    industryName,
  });

  let baseScore: number;
  if (vitality !== null && population !== null && survival !== null) {
    // 서울: 4대 지표 (infraBonus는 별도 보너스로 가산)
    baseScore = Math.round(
      vitality * 0.35 + competition * 0.25 + population * 0.20 + survival * 0.20,
    );
  } else if (population !== null && survival !== null) {
    // 비서울: population 있고 survival도 있는 경우 (방어적 처리)
    baseScore = Math.round(competition * 0.40 + population * 0.35 + survival * 0.25);
  } else if (population !== null) {
    // V-01: 비서울 3지표 — infra 접근성을 정규화하여 편입
    // competition 40% + population 35% + infraAccess 25%
    // infraAccess: MAX_BONUS(15점) 기준 0~100 정규화
    const infraAccess = Math.round((infraBonus.score / 15) * 100);
    baseScore = Math.round(
      competition * 0.40 + population * 0.35 + infraAccess * 0.25
    );
  } else {
    // fallback: competition만
    baseScore = competition;
  }

  // 비서울(infraAccess 편입)에서는 infraBonus 이중 반영 방지
  const isNonSeoulInfraIntegrated = vitality === null && survival === null && population !== null;
  return {
    total: isNonSeoulInfraIntegrated
      ? Math.min(100, baseScore)
      : Math.min(100, baseScore + infraBonus.score),
    infraBonus,
    survivalResult, // V-10: 이중 호출 제거를 위해 반환
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

  const analysis = await prisma.analysisRequest.create({
    data: {
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      industryCode: parsed.data.industryCode,
      industryName: parsed.data.industryName,
      radius: parsed.data.radius,
      status: "PROCESSING",
      userId: user?.id ?? null,
    },
  });

  try {
    const region = parsed.data.districtCode
      ? { districtCode: parsed.data.districtCode, code: parsed.data.districtCode + "00000" }
      : await kakaoGeocoding.coordToRegion(parsed.data.latitude, parsed.data.longitude);

    const aggregated = await runAnalysis({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      regionCode: region.districtCode,
      industryKeywords: extractSearchKeywords(parsed.data.industryCode, parsed.data.industryName),
      industryCode: parsed.data.industryCode,
      industryName: parsed.data.industryName,
      radius: parsed.data.radius,
      adminDongCode: parsed.data.adminDongCode,
      dongName: parsed.data.dongName,
    });

    const { total: totalScore, infraBonus, survivalResult } = calcTotalScore(aggregated, parsed.data.industryName);

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
