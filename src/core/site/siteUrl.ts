/**
 * Where this deployment lives, as far as the outside world is concerned.
 *
 * Canonical links, an Open Graph image and a sitemap all have to be absolute
 * URLs — a relative one is no use to a crawler that has arrived from
 * somewhere else, and no use at all to whatever renders the preview card in a
 * chat window. So something has to know the origin.
 *
 * Deliberately not hardcoded. The project is mid-rename, the Vercel project
 * and domain are still called `pdf_companion`, and burying today's hostname in
 * three files is how a site ends up advertising a URL it no longer answers on.
 * Set `NEXT_PUBLIC_SITE_URL` once the real domain exists; until then Vercel's
 * own production hostname is a better answer than a guess.
 */

export interface SiteEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  /** Set by Vercel to the project's stable production host, without a scheme. */
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  /** "production", "preview" or "development" on Vercel; absent elsewhere. */
  VERCEL_ENV?: string;
  /**
   * An environment carries far more than the two names above, and `process.env`
   * is passed here whole. Without this, TypeScript's weak-type check rejects it
   * for having "no properties in common" with a type whose properties are all
   * optional.
   */
  [key: string]: string | undefined;
}

/** Where a local `next dev` answers, and the only sensible last resort. */
const LOCAL = "http://localhost:3000";

export function siteUrl(env: SiteEnv = {}): string {
  const explicit = normalise(env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  const vercel = normalise(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return vercel;

  return LOCAL;
}

/**
 * Whether this deployment is the real one, and so the one worth finding.
 *
 * Every pull request gets its own preview deployment, serving a complete copy
 * of the landing page on its own hostname. Left indexable those become a
 * hundred near-identical pages competing with the site they were copied from —
 * which is worse for search than not being indexed at all, and is the usual
 * way a Vercel project ends up with its preview URLs outranking its domain.
 *
 * Absent `VERCEL_ENV` this is not a Vercel deployment, and there is no reason
 * to assume it isn't the real one.
 */
export function indexable(env: SiteEnv = {}): boolean {
  const deployment = env.VERCEL_ENV?.trim();
  return !deployment || deployment === "production";
}

/**
 * A configured origin is a human-entered string, so it arrives in every shape
 * a person might type: with a trailing slash, without a scheme, with a path
 * stuck on the end, or as whitespace.
 */
function normalise(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    // Origin only: a canonical link is built by appending a path to this, and
    // a base that already carries one would double it up.
    return url.origin;
  } catch {
    return null;
  }
}
