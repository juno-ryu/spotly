import { prisma } from "@/server/db/prisma";
import { SITE_CONFIG } from "@/constants/site";

// Vercel + Next.js sitemap.ts metadata route의 GSC fetch 실패 우회용 별도 sitemap.
// 일반 Route Handler로 응답 헤더(vary 등)를 깨끗하게 직접 제어한다.
// 참고: vercel/next.js#75836 (Sitemap couldn't fetch in Google Search Console)
export const runtime = "nodejs";
export const revalidate = 3600;
export const dynamic = "force-static";

export async function GET() {
  const reports = await prisma.analysisReport.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const urls = reports
    .map(
      (r) =>
        `  <url>\n    <loc>${SITE_CONFIG.url}/report/${r.id}</loc>\n    <lastmod>${r.createdAt.toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
