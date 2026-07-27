import { describe, it, expect } from "vitest";
import { siteUrl, indexable } from "./siteUrl.js";

describe("indexable", () => {
  it("indexes the production deployment", () => {
    expect(indexable({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("keeps every preview deployment out of the index", () => {
    // Each pull request serves a complete copy of the landing page on its own
    // hostname. Indexed, they compete with the site they were copied from.
    expect(indexable({ VERCEL_ENV: "preview" })).toBe(false);
    expect(indexable({ VERCEL_ENV: "development" })).toBe(false);
  });

  it("assumes anywhere that isn't Vercel is the real thing", () => {
    // Self-hosted, or a local build. Nothing here says otherwise, and refusing
    // to be indexed by default would be a silent way to never be found.
    expect(indexable({})).toBe(true);
    expect(indexable()).toBe(true);
    expect(indexable({ VERCEL_ENV: "  " })).toBe(true);
  });
});

describe("siteUrl", () => {
  it("uses the configured site URL when there is one", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://studiolo.app" })).toBe("https://studiolo.app");
  });

  it("prefers the configured URL over the platform's", () => {
    // The real domain is the canonical one; the deployment host is a fallback,
    // and pointing crawlers at it once a domain exists splits the site in two.
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: "https://studiolo.app",
        VERCEL_PROJECT_PRODUCTION_URL: "pdf-companion.vercel.app",
      }),
    ).toBe("https://studiolo.app");
  });

  it("falls back to the deployment's own host", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "pdf-companion.vercel.app" })).toBe(
      "https://pdf-companion.vercel.app",
    );
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("adds the scheme a bare hostname doesn't have", () => {
    // Vercel supplies the host without one, and a person setting the variable
    // by hand very often does the same.
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "studiolo.app" })).toBe("https://studiolo.app");
  });

  it("keeps http when it was asked for", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:4000" })).toBe("http://localhost:4000");
  });

  it("strips a trailing slash", () => {
    // Canonical links are built by appending a path, so a base ending in a
    // slash produces `//welcome` — a different URL to the one that works.
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://studiolo.app/" })).toBe("https://studiolo.app");
  });

  it("keeps only the origin when a path comes along too", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://studiolo.app/welcome" })).toBe(
      "https://studiolo.app",
    );
  });

  it("ignores a value that is only whitespace", () => {
    // An unset variable in a shell script is an empty string, not undefined.
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "   " })).toBe("http://localhost:3000");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "x.dev" })).toBe(
      "https://x.dev",
    );
  });

  it("ignores a value that isn't a URL at all", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "://" })).toBe("http://localhost:3000");
  });

  it("keeps a non-standard port", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://studiolo.app:8443" })).toBe(
      "https://studiolo.app:8443",
    );
  });
});
