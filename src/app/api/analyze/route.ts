import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { analysisRequestSchema } from "@/features/analysis/schema";
import { runAnalysis } from "@/features/analysis/lib/analysis-orchestrator";
import * as kakaoGeocoding from "@/server/data-sources/kakao-geocoding";
import { INDUSTRY_CODES } from "@/features/analysis/constants/industry-codes";
import type { AnalysisRequest } from "@/features/analysis/schema";

function extractSearchKeywords(industryCode: string, industryName: string): string[] {
  const industry = INDUSTRY_CODES.find((i) => i.code === industryCode);
  if (industry) return [...industry.keywords];
  const keyword = industryName.replace(/전문점|점$/, "") || industryName;
  return [keyword];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // DB 레코드 생성 (PENDING)
  const analysis = await prisma.analysisRequest.create({
    data: {
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      industryCode: parsed.data.industryCode,
      industryName: parsed.data.industryName,
      radius: parsed.data.radius,
      status: "PENDING",
    },
  });

  // 비동기 분석 실행 (응답은 즉시 반환)
  processAnalysis(analysis.id, parsed.data).catch((err) =>
    console.error(`분석 처리 실패 [${analysis.id}]:`, err),
  );

  // 즉시 ID 반환
  return NextResponse.json({ id: analysis.id, status: "PENDING" });
}

/** 비동기 분석 처리 */
async function processAnalysis(id: string, input: AnalysisRequest) {
  await prisma.analysisRequest.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  try {
    const region = input.districtCode
      ? { districtCode: input.districtCode, code: input.districtCode + "00000" }
      : await kakaoGeocoding.coordToRegion(input.latitude, input.longitude);

    const aggregated = await runAnalysis({
      latitude: input.latitude,
      longitude: input.longitude,
      regionCode: region.districtCode,
      industryKeywords: extractSearchKeywords(input.industryCode, input.industryName),
      industryCode: input.industryCode,
      industryName: input.industryName,
      radius: input.radius,
      adminDongCode: input.adminDongCode,
      dongName: input.dongName,
    });

    // 콘솔 요약
    const p = aggregated.places;
    const c = aggregated.competition;
    console.log("\n========== 분석 결과 요약 ==========");
    console.log("[카카오 Places]");
    console.log(`  경쟁 매장 수: ${p.totalCount}건 (샘플: ${p.fetchedCount}건)`);
    console.log("[경쟁 분석]");
    console.log(`  밀집도: 약 ${c.densityPerMeter}m당 1개`);
    console.log(`  직접 경쟁: ${c.directCompetitorCount}건 (${(c.directCompetitorRatio * 100).toFixed(0)}%)`);
    console.log(`  간접 경쟁: ${c.indirectCompetitorCount}건`);
    console.log(`  프랜차이즈: ${c.franchiseCount}건 (${(c.franchiseRatio * 100).toFixed(0)}%)`);
    console.log(`  경쟁 점수: ${c.competitionScore.score}/100 (${c.competitionScore.grade} — ${c.competitionScore.gradeLabel})`);
    console.log(`  기준 밀집도: ${c.densityBaseline}m`);
    if (c.franchiseBrandNames.length > 0) {
      console.log(`  감지 브랜드: ${c.franchiseBrandNames.join(", ")}`);
    }

    if (aggregated.franchise) {
      console.log(`\n[공정위 프랜차이즈]`);
      console.log(`  등록 브랜드: ${aggregated.franchise.brands.length}개 (총 ${aggregated.franchise.totalRegistered}건)`);
    }

    if (aggregated.nps) {
      const n = aggregated.nps;
      console.log("\n[NPS 국민연금]");
      console.log(`  검색 사업장: ${n.totalCount}건`);
      console.log(`  평균 직원 수: ${n.avgEmployeeCount.toFixed(1)}명`);
      console.log(`  평균 월 급여: ${Math.round(n.avgMonthlySalary).toLocaleString()}원`);
      console.log(`  평균 운영 기간: ${n.avgOperatingMonths.toFixed(0)}개월`);
    } else {
      console.log("\n[NPS] 데이터 없음");
    }
    console.log("====================================\n");

    // DB 저장 — 스코어링 없이 raw 데이터만 저장
    await prisma.analysisRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        regionCode: region.code,
        totalScore: 0, // 스코어링 추후 구현
        scoreDetail: {}, // 스코어링 추후 구현
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
