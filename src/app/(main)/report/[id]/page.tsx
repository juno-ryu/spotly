import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { ReportViewer } from "@/features/report/components/report-viewer";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import type { AiReport } from "@/features/report/schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await prisma.analysisReport.findUnique({
    where: { id },
  });

  if (!report) notFound();

  const reportJson = report.aiReportJson as AiReport;
  const totalScore = report.totalScore;
  const { grade: scoreGrade } = scoreToGrade(totalScore);
  const scoreDetail = report.scoreDetail as ScoreBreakdown | undefined;

  return (
    <div className="py-4">
      <BackButton />
      <div className="pl-18">
        <h1 className="text-2xl font-bold" style={GRADIENT_TEXT_STYLE}>{report.address}</h1>
        <p className="text-muted-foreground">{report.industryName} · AI 리포트</p>
      </div>

      <ReportViewer
        report={reportJson}
        totalScore={totalScore}
        scoreGrade={scoreGrade}
        scoreDetail={scoreDetail}
      />
    </div>
  );
}
