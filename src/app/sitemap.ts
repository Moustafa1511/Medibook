import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Only the public, indexable pages. The booking wizard is intentionally included
 * (it is the primary conversion path) but the success page is not: its URL
 * contains a booking reference, which is a capability token (C8, A5).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL;
  const lastModified = new Date("2026-10-06");

  return [
    { url: `${base}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/book`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
