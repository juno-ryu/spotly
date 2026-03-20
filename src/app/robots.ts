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
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
