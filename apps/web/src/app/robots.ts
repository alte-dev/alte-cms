import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://cisemelifboz.com";

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
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
