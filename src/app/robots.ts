import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/cart", "/checkout", "/orders", "/account", "/search"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
