import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import { ShareButton } from "@/components/share-button";
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
    select: {
      address: true,
      industryName: true,
      totalScore: true,
      aiReportJson: true,
    },
  });

  if (!report) return { title: "리포트를 찾을 수 없습니다" };

  const aiReport = report.aiReportJson as AiReport | null;
  const verdict = aiReport?.verdict ?? "";

  // 후킹 포인트 동적 조합 — 있는 데이터만 우선순위대로
  const hooks: string[] = [];
  if (verdict) hooks.push(verdict);
  if (aiReport?.revenueEstimate?.monthlyPerStoreMaan) {
    hooks.push(`예상 월매출 ${Math.round(aiReport.revenueEstimate.monthlyPerStoreMaan)}만원`);
  }
  if (aiReport?.survivalAnalysis?.closeRate != null) {
    hooks.push(`폐업률 ${aiReport.survivalAnalysis.closeRate}%`);
  }
  if (aiReport?.competitorCount) {
    hooks.push(`경쟁업체 ${aiReport.competitorCount.direct}개`);
  }
  if (aiReport?.riskWarnings?.[0]) {
    hooks.push(`⚠️ ${aiReport.riskWarnings[0].title}`);
  }
  if (aiReport?.populationInsight) {
    hooks.push(aiReport.populationInsight.headline);
  }

  const hookLine = hooks.length > 0 ? hooks.slice(0, 4).join(" · ") : "";

  const title = verdict
    ? `${report.address} ${report.industryName} — ${verdict} | 스팟리`
    : `${report.address} ${report.industryName} 창업 분석 | 스팟리`;

  const description = hookLine
    ? `${hookLine}. AI가 민간·공공데이터를 종합 분석한 ${report.address} ${report.industryName} 창업 입지 리포트.`
    : `${report.address}의 ${report.industryName} 창업 입지 분석 — 종합 ${report.totalScore}점. AI가 민간·공공데이터를 종합 분석한 리포트.`;

  const ogParams = new URLSearchParams();
  ogParams.set("address", report.address);
  ogParams.set("industry", report.industryName);
  ogParams.set("score", String(report.totalScore));
  if (verdict) ogParams.set("verdict", verdict);
  if (aiReport?.competitorCount) ogParams.set("competitors", String(aiReport.competitorCount.direct));
  if (aiReport?.competitorCount?.franchise != null) ogParams.set("franchise", String(aiReport.competitorCount.franchise));
  if (aiReport?.revenueEstimate?.monthlyPerStoreMaan) ogParams.set("revenue", String(Math.round(aiReport.revenueEstimate.monthlyPerStoreMaan)));
  if (aiReport?.survivalAnalysis?.closeRate != null) ogParams.set("closeRate", String(aiReport.survivalAnalysis.closeRate));
  if (aiReport?.riskWarnings?.[0]) ogParams.set("risk", aiReport.riskWarnings[0].title);
  if (aiReport?.analysisScope) ogParams.set("scope", aiReport.analysisScope.slice(0, 80));
  if (aiReport?.summary) ogParams.set("summary", aiReport.summary.slice(0, 100));
  const ogImageUrl = `${SITE_CONFIG.url}/api/og?${ogParams}`;

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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
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

  // JSON-LD 구조화 데이터 — 검색 엔진 리치 스니펫용
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${report.address} ${report.industryName} 창업 입지 분석`,
    description: reportJson.summary,
    author: { "@type": "Organization", name: "스팟리" },
    publisher: { "@type": "Organization", name: "스팟리" },
    datePublished: report.createdAt.toISOString(),
    mainEntityOfPage: `${SITE_CONFIG.url}/report/${id}`,
  };

  return (
    <div className="py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 공유 버튼 — 프로필 아이콘 아래 */}
      <ShareButton
        title={`${report.address} ${report.industryName} 창업 점수 ${totalScore}점!`}
        text={`AI가 8개 공공데이터를 분석한 상권 리포트를 확인해보세요.`}
        url={`${SITE_CONFIG.url}/report/${id}`}
        imageUrl={`${SITE_CONFIG.url}/api/og?${new URLSearchParams({ address: report.address, industry: report.industryName, score: String(totalScore), ...(reportJson.verdict && { verdict: reportJson.verdict }), square: "1" })}`}
      />
      <div className="pl-6">
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
