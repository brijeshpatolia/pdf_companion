import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageText, PdfTextPort } from "./types.js";

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export function createPdfTextExtractor(): PdfTextPort {
  return {
    async extractPages(bytes) {
      let doc;
      try {
        doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/password|encrypted/i.test(msg)) {
          const e = new Error("This PDF is password-protected. Please remove the password and re-upload.");
          (e as any).code = "encrypted";
          throw e;
        }
        const e = new Error(`Failed to open PDF: ${msg}`);
        (e as any).code = "corrupt";
        throw e;
      }

      try {
        const pages: PageText[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const text = reconstructText(content.items as TextItem[], i === 1 ? null : pages);
          pages.push({ page: i, text });
        }
        return pages;
      } finally {
        await doc.destroy();
      }
    },
  };
}

function reconstructText(items: TextItem[], previousPages: PageText[] | null): string {
  if (items.length === 0) return "";

  const sorted = sortReadingOrder(items);
  const lines = groupIntoLines(sorted);
  let text = joinLines(lines);

  text = stripPageNumbers(text);

  if (previousPages && previousPages.length > 0) {
    text = stripRepeatHeaders(text, previousPages);
  }

  text = dehyphenate(text);

  return text.trim();
}

function sortReadingOrder(items: TextItem[]): TextItem[] {
  return [...items].sort((a, b) => {
    const ay = a.transform[5]!;
    const by = b.transform[5]!;
    const yDiff = by - ay;
    if (Math.abs(yDiff) > 2) return yDiff > 0 ? 1 : -1;
    return a.transform[4]! - b.transform[4]!;
  });
}

function groupIntoLines(items: TextItem[]): string[][] {
  if (items.length === 0) return [];

  const lines: string[][] = [];
  let currentLine: string[] = [];
  let lastY = items[0]!.transform[5]!;
  let lastRight = 0;

  for (const item of items) {
    const y = item.transform[5]!;
    const x = item.transform[4]!;

    if (Math.abs(y - lastY) > 2) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [];
      lastRight = 0;
    }

    if (currentLine.length > 0 && x - lastRight > 2) {
      currentLine.push(" ");
    }

    currentLine.push(item.str);
    lastRight = x + item.width;
    lastY = y;
  }

  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

function joinLines(lines: string[][]): string {
  return lines.map((tokens) => tokens.join("")).join("\n");
}

function dehyphenate(text: string): string {
  return text.replace(/(\w)-\n(\w)/g, "$1$2\n");
}

function stripPageNumbers(text: string): string {
  const lines = text.split("\n");
  return lines.filter((line) => !/^\s*\d+\s*$/.test(line)).join("\n");
}

function stripRepeatHeaders(text: string, previousPages: PageText[]): string {
  const lines = text.split("\n");
  if (lines.length < 3) return text;

  const prevTexts = previousPages.map((p) => p.text);
  const prevFirstLines = new Set(
    prevTexts.map((t) => t.split("\n")[0]?.trim()).filter(Boolean),
  );
  const prevLastLines = new Set(
    prevTexts.map((t) => {
      const ls = t.split("\n");
      return ls[ls.length - 1]?.trim();
    }).filter(Boolean),
  );

  const filtered = lines.filter((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (i === 0 && prevFirstLines.has(trimmed)) return false;
    if (i === lines.length - 1 && prevLastLines.has(trimmed)) return false;
    return true;
  });

  return filtered.join("\n");
}
