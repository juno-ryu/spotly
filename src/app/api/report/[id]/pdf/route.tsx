import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/server/db/prisma";
import { AnalysisReportPDF } from "@/features/report/lib/pdf-template";
import { aiReportSchema } from "@/features/report/schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";

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

  if (!analysis.aiReportJson) {
    return NextResponse.json(
      { error: "AI 리포트가 아직 생성되지 않았습니다" },
      { status: 400 },
    );
  }

  // AI 리포트 데이터 파싱
  const report = aiReportSchema.parse(analysis.aiReportJson);

  // PDF 렌더링
  try {
    const buffer = await renderToBuffer(
      <AnalysisReportPDF
        address={analysis.address}
        industryName={analysis.industryName}
        radius={analysis.radius}
        scoreDetail={analysis.scoreDetail as ScoreBreakdown | null}
        report={report}
        createdAt={analysis.createdAt.toISOString()}
      />,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="analysis-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF 렌더링 실패:", error);
    return NextResponse.json(
      { error: `PDF 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
