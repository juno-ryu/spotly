import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/report/"],
        disallow: [
          "/api/",
          "/analyze",
          "/history",
          "/auth/",
          "/offline",
          "/industry",
          "/region",
          "/map",
        ],
      },
    ],
    // GSC fetch 실패 우회를 위해 두 sitemap을 모두 노출 — 메타데이터 라우트(/sitemap.xml)와
    // 별도 Route Handler 구현체(/sitemap-index.xml). 둘 중 하나라도 Google이 fetch 성공하면 OK.
    sitemap: [`${SITE_CONFIG.url}/sitemap.xml`, `${SITE_CONFIG.url}/sitemap-index.xml`],
  };
}
