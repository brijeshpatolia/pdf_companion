/**
 * Turn chapter texts into fixed-size synthetic "pages" so an EPUB (which has
 * no inherent pages) flows through the page-based ingestion, retrieval, and
 * reading-progress pipeline. A page never spans two chapters, so chapters
 * always start fresh, and splits prefer paragraph then word boundaries.
 */

const DEFAULT_TARGET = 1800; // ~a screen of reading

export function paginateChapters(
  chapters: string[],
  targetChars: number = DEFAULT_TARGET,
): string[] {
  const pages: string[] = [];
  for (const chapter of chapters) {
    const text = chapter.trim();
    if (!text) continue;
    for (const page of paginateOne(text, targetChars)) {
      pages.push(page);
    }
  }
  return pages;
}

function paginateOne(text: string, targetChars: number): string[] {
  if (text.length <= targetChars) return [text];

  const pages: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) pages.push(trimmed);
    current = "";
  };

  for (const para of paragraphs) {
    // A single paragraph larger than the target is split on word boundaries.
    if (para.length > targetChars) {
      flush();
      for (const piece of splitLongParagraph(para, targetChars)) {
        pages.push(piece);
      }
      continue;
    }

    if (current && current.length + para.length + 2 > targetChars) {
      flush();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();

  return pages;
}

function splitLongParagraph(para: string, targetChars: number): string[] {
  const words = para.split(/\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const word of words) {
    if (current && current.length + word.length + 1 > targetChars) {
      pieces.push(current);
      current = "";
    }
    current = current ? `${current} ${word}` : word;
  }
  if (current) pieces.push(current);

  return pieces;
}
