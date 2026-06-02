import { prisma } from "@/server/db/prisma";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import type { AiReport } from "@/features/report/schema";

/** 웰컴 화면 미리보기 카드용 — 서울 고득점 상위 N개 중 랜덤 1개 */
const SEOUL_TOP_LIMIT = 10;

export interface PreviewReport {
  id: string;
  address: string;
  industryName: string;
  totalScore: number;
  lat: number | null;
  lng: number | null;
  scoreDetail: ScoreBreakdown | null;
  aiReportJson: AiReport | null;
}

/**
 * 서울 totalScore desc 상위 10개 중 매 요청 랜덤 1개 반환.
 * 데이터 없으면 null.
 */
export async function getRandomPreviewReport(): Promise<PreviewReport | null> {
  const rows = await prisma.analysisReport.findMany({
    where: { address: { startsWith: "서울" } },
    select: {
      id: true,
      address: true,
      industryName: true,
      totalScore: true,
      lat: true,
      lng: true,
      scoreDetail: true,
      aiReportJson: true,
    },
    orderBy: { totalScore: "desc" },
    take: SEOUL_TOP_LIMIT,
  });

  if (rows.length === 0) return null;

  const picked = rows[Math.floor(Math.random() * rows.length)];
  return {
    ...picked,
    scoreDetail: picked.scoreDetail as unknown as ScoreBreakdown | null,
    aiReportJson: picked.aiReportJson as unknown as AiReport | null,
  };
}

/** 점수 → 짧은 verdict 라벨 */
function scoreToVerdict(score: number): string {
  if (score >= 75) return "추천 입지";
  if (score >= 60) return "조건부 추천";
  if (score >= 40) return "주의 필요";
  return "비추천";
}

/** 점수 → 등급 */
function scoreToGradeLetter(score: number): string {
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

/** 4단계 view-only 인트로 + 카카오 공유 카드에 쓰는 통합 데이터 */
export interface PreviewData {
  id: string;
  address: string;
  industryName: string;
  totalScore: number;
  grade: string;
  verdict: string;
  lat: number | null;
  lng: number | null;
  scoreDetail: ScoreBreakdown | null;
  aiReportJson: AiReport | null;
  ogHorizontalUrl: string;
  ogSquareUrl: string;
}

function buildOgUrl(report: PreviewReport, square: boolean): string {
  const params = new URLSearchParams({
    address: report.address,
    industry: report.industryName,
    score: String(Math.round(report.totalScore)),
    verdict: scoreToVerdict(report.totalScore),
  });
  if (square) params.set("square", "1");
  return `/api/og?${params.toString()}`;
}

/** 랜덤 1개 + horizontal/square OG URL + 표시용 데이터 통합 반환 */
export async function getRandomPreviewData(): Promise<PreviewData | null> {
  const report = await getRandomPreviewReport();
  if (!report) return null;

  return {
    id: report.id,
    address: report.address,
    industryName: report.industryName,
    totalScore: Math.round(report.totalScore),
    grade: scoreToGradeLetter(report.totalScore),
    verdict: scoreToVerdict(report.totalScore),
    lat: report.lat,
    lng: report.lng,
    scoreDetail: report.scoreDetail,
    aiReportJson: report.aiReportJson,
    ogHorizontalUrl: buildOgUrl(report, false),
    ogSquareUrl: buildOgUrl(report, true),
  };
}
