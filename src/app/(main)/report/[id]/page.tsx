export const dynamic = "force-dynamic";
// AI 리포트 생성은 Claude API 호출로 시간이 걸리므로 Vercel 타임아웃 연장
export const maxDuration = 60;

import { Suspense } from "react";
import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { ReportViewer } from "@/features/report/components/report-viewer";
import { generateReport } from "@/features/report/actions";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import { ReportLoading } from "@/features/report/components/report-loading";
import type { AiReport } from "@/features/report/schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";

/** AI 리포트 생성 + 표시를 담당하는 내부 서버 컴포넌트 */
async function ReportContent({ id }: { id: string }) {
  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
    select: {
      status: true,
      aiReportJson: true,
      totalScore: true,
      scoreDetail: true,
    },
  });

  if (!analysis) notFound();

  if (analysis.status !== "COMPLETED") {
    throw new Error("분석이 아직 완료되지 않았습니다.");
  }

  // aiReportJson이 없으면 서버에서 직접 생성
  let reportJson = analysis.aiReportJson as AiReport | null;
  if (!reportJson) {
    const result = await generateReport(id);
    if (!result.success) {
      throw new Error(result.error);
    }
    reportJson = result.data as AiReport;
  }

  const totalScore = analysis.totalScore ?? 0;
  const { grade: scoreGrade } = scoreToGrade(totalScore);

  return (
    <ReportViewer
      report={reportJson}
      totalScore={totalScore}
      scoreGrade={scoreGrade}
      scoreDetail={analysis.scoreDetail as ScoreBreakdown | undefined}
    />
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
    select: {
      address: true,
      industryName: true,
    },
  });

  if (!analysis) notFound();

  return (
    <div className="py-4">
      <BackButton />
      <div className="pl-18">
        <h1 className="text-2xl font-bold" style={GRADIENT_TEXT_STYLE}>{analysis.address}</h1>
        <p className="text-muted-foreground">{analysis.industryName} · AI 리포트</p>
      </div>

      <Suspense fallback={<ReportLoading />}>
        <ReportContent id={id} />
      </Suspense>
    </div>
  );
}
