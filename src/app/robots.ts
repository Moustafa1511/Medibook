import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin area holds patient data and the dev style guide is not a
        // public surface; the success page carries a capability token in its URL
        // and is separately marked noindex (A5).
        disallow: ["/admin", "/admin/", "/dev/", "/api/", "/book/success/"],
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
