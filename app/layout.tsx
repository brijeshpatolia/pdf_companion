import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import ServiceWorker from "./components/ServiceWorker";

/*
 * Three families, each with one job — the split is the design, not decoration.
 * Fraunces carries display, Instrument Sans carries UI chrome, and Source
 * Serif is reserved for the reading surfaces: the book page, the Ask field,
 * long-form passages on paper.
 */
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const reading = Source_Serif_4({ subsets: ["latin"], variable: "--font-reading", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Studiolo",
    template: "%s · Studiolo",
  },
  description:
    "A reading companion for hard books — always on your page, holding the whole book in mind.",
  applicationName: "Studiolo",
  appleWebApp: {
    capable: true,
    title: "Studiolo",
    // The chrome is dark, so the status bar should be too.
    statusBarStyle: "black-translucent",
  },
  // Nothing here is worth indexing on someone's behalf, and a library is
  // private by construction.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#141312",
  /*
   * Lets the page reach under the notch and the home indicator — which is what
   * makes `env(safe-area-inset-*)` resolve to anything other than zero. The
   * nav bar is fixed to the bottom of the screen and pads itself with that
   * inset, so without this it would sit under the home indicator on any phone
   * that has one.
   */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${reading.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
