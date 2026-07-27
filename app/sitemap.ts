import type { MetadataRoute } from "next";
import { siteUrl } from "@/core/site/siteUrl.js";

/**
 * One entry, and that is the honest size of it.
 *
 * A sitemap lists the pages worth indexing. Here that is the landing page —
 * everything else is either behind a sign-in or behind a private link, and
 * listing those would be advertising the addresses of things nobody asked to
 * have advertised.
 *
 * `/login` is crawlable but omitted deliberately: a sign-in form is a fine
 * thing to land on from a bookmark and a poor thing to find in a search
 * result, where the landing page answers the question instead.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl(process.env);
  return [
    {
      url: `${base}/welcome`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
