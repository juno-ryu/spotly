import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/server/db/prisma";
import { AnalysisReportPDF } from "@/features/report/lib/pdf-template";
import { aiReportSchema } from "@/features/report/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const report = await prisma.analysisReport.findUnique({
    where: { id },
  });

  if (!report) {
    return NextResponse.json(
      { error: "리포트를 찾을 수 없습니다" },
      { status: 404 },
    );
  }

  const reportJson = aiReportSchema.parse(report.aiReportJson);

  try {
    const buffer = await renderToBuffer(
      <AnalysisReportPDF
        address={report.address}
        industryName={report.industryName}
        report={reportJson}
        createdAt={report.createdAt.toISOString()}
      />,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${id}.pdf"`,
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
