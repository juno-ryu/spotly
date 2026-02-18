"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { analysisRequestSchema } from "./schema";
import { runAnalysis } from "./lib/analysis-orchestrator";
import * as kakaoGeocoding from "@/server/data-sources/kakao/client";
import { INDUSTRY_CODES } from "./constants/industry-codes";
import type { AnalysisRequest } from "./schema";

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

  const analysis = await prisma.analysisRequest.create({
    data: {
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      industryCode: parsed.data.industryCode,
      industryName: parsed.data.industryName,
      radius: parsed.data.radius,
      status: "PROCESSING",
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

    await prisma.analysisRequest.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        regionCode: region.code,
        totalScore: aggregated.competition.competitionScore.score,
        scoreDetail: JSON.parse(JSON.stringify({
          competition: aggregated.competition.competitionScore,
          vitality: aggregated.vitality?.vitalityScore ?? null,
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
