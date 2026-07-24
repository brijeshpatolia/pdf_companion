/**
 * Renders everything a reader has kept for one book — highlights, saved AI
 * answers, and notes — into a single, portable Markdown document. Pure so it's
 * easy to test; the route feeds it rows and returns the string as a file.
 */

export interface ExportHighlight {
  page: number;
  text: string;
  createdAt: string;
}

export interface ExportAnswer {
  page: number;
  question?: string;
  text: string;
  createdAt: string;
}

export interface ExportNote {
  page: number | null;
  text: string;
  updatedAt: string;
}

export interface ExportInput {
  bookTitle: string;
  exportedAt?: string; // ISO; defaults to now
  highlights: ExportHighlight[];
  answers: ExportAnswer[];
  notes: ExportNote[];
}

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Indent every line of `text` as a Markdown blockquote. */
function quote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
}

export function buildExportMarkdown(input: ExportInput): string {
  const { bookTitle, highlights, answers, notes } = input;
  const exportedAt = input.exportedAt ?? new Date().toISOString();

  const out: string[] = [];
  out.push(`# ${bookTitle.trim() || "Untitled"}`);
  out.push(`*Exported from PDF Companion on ${day(exportedAt)}*`);

  if (highlights.length === 0 && answers.length === 0 && notes.length === 0) {
    out.push("");
    out.push("_Nothing saved for this book yet._");
    return out.join("\n") + "\n";
  }

  if (highlights.length > 0) {
    out.push("");
    out.push(`## Highlights (${highlights.length})`);
    for (const h of highlights) {
      out.push("");
      out.push(quote(h.text));
      out.push(`— p. ${h.page}`);
    }
  }

  if (answers.length > 0) {
    out.push("");
    out.push(`## Saved answers (${answers.length})`);
    for (const a of answers) {
      out.push("");
      const heading = a.question?.trim() ? a.question.trim() : "Answer";
      out.push(`### ${heading}`);
      out.push(`*p. ${a.page}*`);
      out.push("");
      out.push(a.text.trim());
    }
  }

  if (notes.length > 0) {
    out.push("");
    out.push(`## Notes (${notes.length})`);
    for (const n of notes) {
      out.push("");
      const anchor = n.page != null ? `p. ${n.page} · ` : "";
      out.push(`- **${anchor}${day(n.updatedAt)}**`);
      for (const line of n.text.trim().split("\n")) {
        out.push(`  ${line}`.trimEnd());
      }
    }
  }

  return out.join("\n") + "\n";
}

/** A safe download filename for a book, e.g. "the-republic.md". */
export function exportFilename(bookTitle: string): string {
  const slug = bookTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "book"}.md`;
}
