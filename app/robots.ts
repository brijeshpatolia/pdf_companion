import type { MetadataRoute } from "next";
import { siteUrl, indexable } from "@/core/site/siteUrl.js";

/**
 * What a crawler is welcome to look at, which is almost nothing.
 *
 * The per-page `noindex` tags are what actually keep pages out of an index —
 * a crawler has to fetch a page to read one. This file is the coarser
 * instrument: it says don't bother fetching at all, which keeps someone's
 * share link from being requested by a bot that found it in a referrer header
 * somewhere.
 *
 * Both are needed and they are not the same thing. Disallowing a path here
 * without a `noindex` on the page can still leave the URL listed with no
 * description, because a disallowed page is one the crawler was never allowed
 * to read the tag on.
 */
export default function robots(): MetadataRoute.Robots {
  // A preview deployment is a copy of the site on a throwaway hostname. It
  // turns nothing away in the app itself — the point of a preview is to be
  // opened and used — but it should not be crawled at all.
  if (!indexable(process.env)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/welcome", "/login"],
      /*
       * Named paths rather than a blanket `Disallow: /` with exceptions.
       * Whether an `Allow` beats a broader `Disallow` depends on the crawler —
       * Google takes the longest match, others take the first — and the one
       * page that must stay reachable is not worth betting on that. The bare
       * root is left alone deliberately: it redirects a visitor with no
       * session to `/welcome`, so a crawler arriving at the domain lands on
       * the page written for it.
       */
      disallow: [
        "/api/",
        "/auth/",
        "/reader/",
        "/ask",
        "/usage",
        "/catalog",
        // Someone's reading, behind a link they chose who to give it to.
        "/share/",
        "/room/",
      ],
    },
    sitemap: `${siteUrl(process.env)}/sitemap.xml`,
  };
}
