import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/constants/site";
import { prisma } from "@/server/db/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_CONFIG.url;

  // 공개 리포트 페이지 동적 수집
  const reports = await prisma.analysisReport.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const reportEntries: MetadataRoute.Sitemap = reports.map((report) => ({
    url: `${baseUrl}/report/${report.id}`,
    lastModified: report.createdAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...reportEntries,
  ];
}
