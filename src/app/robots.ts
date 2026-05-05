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
    // GSC가 /sitemap.xml에 대해 fetch 실패 누적으로 시도 중단 상태.
    // 새 URL(/pages-index.xml)을 추가 노출해 GSC 백엔드 캐시 우회.
    sitemap: [`${SITE_CONFIG.url}/sitemap.xml`, `${SITE_CONFIG.url}/pages-index.xml`],
  };
}
