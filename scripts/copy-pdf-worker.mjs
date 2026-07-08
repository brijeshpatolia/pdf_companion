// Copies the pdfjs worker into public/ so its version matches the pdfjs that
// react-pdf imports. react-pdf pins its own (possibly nested) pdfjs-dist, so we
// prefer that copy and fall back to the hoisted one. Runs on postinstall.
import { existsSync, copyFileSync, mkdirSync } from "node:fs";

const candidates = [
  "node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.warn("[copy-pdf-worker] no pdfjs worker found; skipping");
  process.exit(0);
}

mkdirSync("public", { recursive: true });
copyFileSync(src, "public/pdf.worker.min.mjs");
console.log(`[copy-pdf-worker] copied ${src} -> public/pdf.worker.min.mjs`);
