import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
  });

  if (!analysis) {
    return NextResponse.json(
      { error: "분석 결과를 찾을 수 없습니다" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: analysis.id,
    status: analysis.status,
    address: analysis.address,
    industryName: analysis.industryName,
    radius: analysis.radius,
    totalScore: analysis.totalScore,
    scoreDetail: analysis.scoreDetail,
    reportData: analysis.reportData,
    aiSummary: analysis.aiSummary,
    aiReportJson: analysis.aiReportJson,
    createdAt: analysis.createdAt.toISOString(),
  });
}
