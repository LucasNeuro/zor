import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const isProd = appUrl.startsWith("https://");

  return {
    rules: isProd
      ? [
          {
            userAgent: "*",
            allow: "/",
          },
        ]
      : [
          {
            userAgent: "*",
            disallow: "/",
          },
        ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
