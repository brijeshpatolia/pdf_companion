import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Companion",
  description: "An AI that reads with you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
