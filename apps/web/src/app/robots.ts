import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/sepet",
          "/sepet/",
          "/odeme",
          "/odeme/",
          "/onizleme",
          "/onizleme/",
          "/ara",
          "/ara/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
