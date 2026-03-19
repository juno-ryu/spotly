import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { ReportViewer } from "@/features/report/components/report-viewer";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { GRADIENT_TEXT_STYLE, SITE_CONFIG } from "@/constants/site";
import type { AiReport } from "@/features/report/schema";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await prisma.analysisReport.findUnique({
    where: { id },
    select: { address: true, industryName: true, totalScore: true },
  });

  if (!report) return { title: "리포트를 찾을 수 없습니다" };

  const title = `${report.address} ${report.industryName} 창업 분석`;
  const description = `${report.address}의 ${report.industryName} 창업 입지 분석 결과 — 종합 점수 ${report.totalScore}점. 경쟁 강도, 유동인구, 인프라 등 AI 리포트를 확인하세요.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/report/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_CONFIG.url}/report/${id}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

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
