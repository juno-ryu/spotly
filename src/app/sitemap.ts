import type { MetadataRoute } from "next";
import { prisma } from "@/server/db/prisma";
import { SITE_CONFIG } from "@/constants/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reports = await prisma.analysisReport.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return [
    {
      url: SITE_CONFIG.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...reports.map((r) => ({
      url: `${SITE_CONFIG.url}/report/${r.id}`,
      lastModified: r.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
