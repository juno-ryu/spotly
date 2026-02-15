import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { analysisRequestSchema } from "@/features/analysis/schema";
import { aggregateAnalysisData } from "@/features/analysis/lib/data-aggregator";
import { calculateTotalScore } from "@/features/analysis/lib/scoring-engine";
import * as kakaoGeocoding from "@/server/data-sources/kakao-geocoding";
import { POPULAR_INDUSTRIES } from "@/constants/enums/industry-type";
import type { AnalysisRequest } from "@/features/analysis/schema";

/** 업종코드 → NPS 검색 키워드 추출 */
function extractSearchKeyword(industryCode: string, industryName: string): string {
  // 인기 업종 목록에서 첫 번째 keyword 사용
  const industry = POPULAR_INDUSTRIES.find((i) => i.code === industryCode);
  if (industry) return industry.keywords[0];
  // 없으면 이름에서 공통 접미사 제거
  return industryName.replace(/전문점|음식점|점$/, "") || industryName;
}

export async function POST(request: NextRequest) {
  // 1. 입력 검증
  const body = await request.json();
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 2. DB 레코드 생성 (PENDING)
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

  // 3. 비동기 분석 실행 (응답은 즉시 반환)
  processAnalysis(analysis.id, parsed.data).catch((err) =>
    console.error(`분석 처리 실패 [${analysis.id}]:`, err),
  );

  // 4. 즉시 ID 반환
  return NextResponse.json({ id: analysis.id, status: "PENDING" });
}

/** 비동기 분석 처리 */
async function processAnalysis(id: string, input: AnalysisRequest) {
  await prisma.analysisRequest.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  try {
    // 좌표 → 법정동코드 추출 (districtCode가 있으면 Kakao 지오코딩 스킵)
    const region = input.districtCode
      ? { districtCode: input.districtCode, code: input.districtCode + "00000" }
      : await kakaoGeocoding.coordToRegion(input.latitude, input.longitude);

    // 데이터 수집 (병렬)
    const aggregated = await aggregateAnalysisData({
      latitude: input.latitude,
      longitude: input.longitude,
      regionCode: region.districtCode,
      industryKeyword: extractSearchKeyword(input.industryCode, input.industryName),
      industryCode: input.industryCode,
      radius: input.radius,
    });

    // 점수 계산
    const score = calculateTotalScore(aggregated);

    // DB 업데이트 (완료)
    await prisma.analysisRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        regionCode: region.code,
        totalScore: score.total,
        scoreDetail: score.breakdown,
        reportData: JSON.parse(JSON.stringify({
          ...aggregated,
          confidence: score.confidence,
        })),
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
