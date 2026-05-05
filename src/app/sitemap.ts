import type { MetadataRoute } from "next";
import { prisma } from "@/server/db/prisma";
import { SITE_CONFIG } from "@/constants/site";

// 1시간마다 재생성 — Vercel이 빌드 시점에 sitemap을 정적 동결하는 것을 방지.
// 새 리포트가 생성되어도 sitemap에 자동 반영되도록 ISR 적용.
export const revalidate = 3600;

/**
 * Next.js 표준 sitemap 라우트 → /sitemap.xml로 자동 매핑.
 * 메인(/)은 환영 게이트 페이지라 색인 가치가 없어 sitemap에서 제외.
 * 의미 있는 콘텐츠는 분석 리포트(/report/[id])뿐이므로 리포트만 노출한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reports = await prisma.analysisReport.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    url: `${SITE_CONFIG.url}/report/${r.id}`,
    lastModified: r.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
}
