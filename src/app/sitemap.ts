import type { MetadataRoute } from "next";
import { prisma } from "@/server/db/prisma";
import { SITE_CONFIG } from "@/constants/site";

// 1시간마다 재생성 — 빌드 시점 정적 동결 방지.
export const revalidate = 3600;

/**
 * Next.js 표준 sitemap metadata route → /sitemap.xml로 자동 매핑.
 * 메인(/)은 환영 게이트 페이지라 제외.
 * 최신 리포트 20개만 노출 — 도메인 평가용 핵심 콘텐츠 시그널.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reports = await prisma.analysisReport.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return reports.map((r) => ({
    url: `${SITE_CONFIG.url}/report/${r.id}`,
    lastModified: r.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
}
