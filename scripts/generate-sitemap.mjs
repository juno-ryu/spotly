/**
 * 빌드 시점에 public/sitemap.xml 정적 파일을 생성한다.
 *
 * 배경:
 * - Next.js의 app/sitemap.ts(metadata route) 응답에 `vary: rsc, next-router-state-tree, ...`
 *   헤더가 자동 추가되어 Google Search Console fetch가 실패하는 알려진 이슈
 *   (vercel/next.js#75836).
 * - public/ 디렉토리의 정적 파일은 Vercel Edge가 Next.js를 거치지 않고 직접 서빙하므로
 *   응답 헤더가 깨끗하다 (vary 없음 — 실측 검증).
 *
 * 동작:
 * - DB에서 분석 리포트 목록 조회 → public/sitemap.xml 생성.
 * - 메인(/)은 환영 게이트 페이지라 색인 가치 없어 제외.
 * - 매 deploy마다 갱신 → 새 리포트는 다음 빌드 후 sitemap 진입.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const SITE_URL = "https://spotly.website";

async function main() {
  const prisma = new PrismaClient();

  try {
    const reports = await prisma.analysisReport.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // Google sitemap 스펙은 W3C Datetime 권장 (YYYY-MM-DDTHH:MM:SSZ).
    // toISOString() 기본은 milliseconds(.697Z)를 포함해서 일부 파서가 거부.
    // milliseconds 제거해서 표준 형식으로 출력.
    const urls = reports
      .map((r) => {
        const lastmod = r.createdAt.toISOString().replace(/\.\d{3}Z$/, "Z");
        return `  <url>\n    <loc>${SITE_URL}/report/${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

    const publicDir = join(process.cwd(), "public");
    mkdirSync(publicDir, { recursive: true });

    // sitemap.xml은 stuck 상태 가능. GSC 캐시 우회를 위해 새 이름의 동일 파일 추가 생성.
    const fileNames = ["sitemap.xml", "pages-index.xml"];
    for (const name of fileNames) {
      const outPath = join(publicDir, name);
      writeFileSync(outPath, xml, "utf-8");
      console.log(`✓ ${name} generated: ${reports.length} URLs → ${outPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("sitemap generation failed:", error);
  process.exit(1);
});
