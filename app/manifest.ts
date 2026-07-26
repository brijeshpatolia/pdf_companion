import type { MetadataRoute } from "next";

/**
 * What the app is when it's installed to a home screen.
 *
 * Reading happens on a phone, in the gaps — so being one tap from the home
 * screen, without a browser's address bar taking a fifth of the page, is worth
 * more here than it would be for most web apps.
 *
 * `start_url` is the library rather than the landing page: someone who has
 * installed this has already been told what it is.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PDF Companion",
    // What fits under an icon. The full name truncates on most launchers.
    short_name: "Companion",
    description:
      "An AI that reads with you — always on your page, holding the whole book in mind.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0b0a",
    theme_color: "#141312",
    categories: ["books", "education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops this to whatever shape the launcher uses, so it's drawn
      // full-bleed with the art inside the safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask your library", short_name: "Ask", url: "/ask" },
      { name: "Free books", short_name: "Free", url: "/catalog" },
    ],
  };
}
