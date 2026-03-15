"use server";

import { prisma } from "@/server/db/prisma";
import { analysisRequestSchema } from "./schema";
import { runAnalysis } from "./lib/analysis-orchestrator";
import * as kakaoGeocoding from "@/server/data-sources/kakao/client";

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

/** 분석 시작 — DB 레코드만 즉시 생성 후 ID 반환 (분석 실행은 결과 페이지에서 수행) */
export async function startAnalysis(input: AnalysisRequest) {
  const parsed = analysisRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error("입력값이 올바르지 않습니다");

  const displayName = parsed.data.industryKeyword || parsed.data.industryName;

  const analysis = await prisma.analysisRequest.create({
    data: {
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      industryCode: parsed.data.industryCode,
      industryName: displayName,
      radius: parsed.data.radius,
      status: "PROCESSING",
      // 분석 실행에 필요한 전처리 데이터를 reportData에 임시 저장
      reportData: JSON.parse(JSON.stringify({
        _pendingInput: {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          industryCode: parsed.data.industryCode,
          industryName: parsed.data.industryName,
          industryKeyword: parsed.data.industryKeyword,
          radius: parsed.data.radius,
          districtCode: parsed.data.districtCode,
          adminDongCode: parsed.data.adminDongCode,
          dongName: parsed.data.dongName,
        },
      })),
    },
  });

  return analysis.id;
}

/** 분석 실행 — 결과 페이지 서버 컴포넌트에서 호출, COMPLETED이면 skip */
export async function executeAnalysis(id: string) {
  const analysis = await prisma.analysisRequest.findUnique({ where: { id } });
  if (!analysis) return;

  // 이미 완료/실패 상태면 재실행하지 않음
  if (analysis.status === "COMPLETED" || analysis.status === "FAILED") return;

  // reportData에 임시 저장된 pendingInput 추출
  const reportData = analysis.reportData as Record<string, unknown> | null;
  const pending = (reportData?._pendingInput ?? null) as {
    latitude: number;
    longitude: number;
    industryCode: string;
    industryName: string;
    industryKeyword?: string;
    radius: number;
    districtCode?: string;
    adminDongCode?: string;
    dongName?: string;
  } | null;

  if (!pending) {
    // pendingInput이 없으면 FAILED 처리
    await prisma.analysisRequest.update({
      where: { id },
      data: { status: "FAILED" },
    });
    return;
  }

  try {
    // districtCode가 있어도 adminDongCode가 없으면 서버 coordToRegion으로 보완
    // (카카오 JS SDK가 지하철역/상업지구 좌표에서 H 타입 미반환하는 버그 우회)
    const region =
      pending.districtCode && pending.adminDongCode
        ? { districtCode: pending.districtCode, code: pending.districtCode + "00000", adminDongCode: pending.adminDongCode }
        : await kakaoGeocoding.coordToRegion(pending.latitude, pending.longitude);

    const aggregated = await runAnalysis({
      latitude: pending.latitude,
      longitude: pending.longitude,
      regionCode: region.districtCode,
      industryKeywords: extractSearchKeywords(pending.industryCode, pending.industryName),
      industryCode: pending.industryCode,
      industryName: pending.industryName,
      industryKeyword: pending.industryKeyword,
      radius: pending.radius,
      // 서버 coordToRegion 결과 우선, 없으면 클라이언트 전달값 사용
      adminDongCode: region.adminDongCode ?? pending.adminDongCode,
      dongName: pending.dongName,
    });

    const { total: totalScore, infraBonus, survivalResult, infraAccessScore } = calcTotalScore(aggregated, pending.industryName, region.districtCode);

    await prisma.analysisRequest.update({
      where: { id },
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
    console.error(`분석 실패 [${id}]:`, error);
    await prisma.analysisRequest.update({
      where: { id },
      data: { status: "FAILED" },
    });
  }
}
