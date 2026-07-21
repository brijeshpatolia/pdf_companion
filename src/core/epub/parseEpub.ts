import { unzipSync } from "fflate";
import { htmlToText } from "./htmlToText.js";

export interface ParsedEpub {
  title: string | null;
  /** Chapter texts in spine (reading) order, empties dropped. */
  chapters: string[];
}

const decoder = new TextDecoder("utf-8");

/**
 * Parse EPUB bytes into ordered chapter texts. An EPUB is a ZIP whose
 * `META-INF/container.xml` points at an OPF package file; the OPF's spine
 * gives the reading order of the XHTML documents in the manifest.
 */
export function parseEpub(bytes: Uint8Array): ParsedEpub {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (err) {
    throw epubError(`not a valid EPUB (unzip failed): ${(err as Error).message}`);
  }

  const containerXml = readFile(files, "META-INF/container.xml");
  if (!containerXml) throw epubError("missing META-INF/container.xml");

  const opfPath = matchAttr(containerXml, "rootfile", "full-path");
  if (!opfPath) throw epubError("container.xml has no rootfile path");

  const opfXml = readFile(files, opfPath);
  if (!opfXml) throw epubError(`missing OPF package file: ${opfPath}`);

  const opfDir = dirname(opfPath);
  const title = extractTitle(opfXml);

  // manifest: id → href
  const manifest = new Map<string, string>();
  for (const tag of matchTags(opfXml, "item")) {
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    if (id && href) manifest.set(id, href);
  }

  // spine: ordered idrefs → resolved hrefs → chapter text
  const chapters: string[] = [];
  for (const tag of matchTags(opfXml, "itemref")) {
    const idref = attr(tag, "idref");
    if (!idref) continue;
    const href = manifest.get(idref);
    if (!href) continue;

    const path = resolvePath(opfDir, href);
    const xhtml = readFile(files, path);
    if (!xhtml) continue;

    const text = htmlToText(xhtml);
    if (text.trim()) chapters.push(text);
  }

  if (chapters.length === 0) {
    throw epubError("no readable chapters found in EPUB spine");
  }

  return { title, chapters };
}

function epubError(message: string): Error {
  const e = new Error(message);
  (e as { code?: string }).code = "corrupt";
  return e;
}

// ZIP paths are case-sensitive and always forward-slashed.
function readFile(files: Record<string, Uint8Array>, path: string): string | null {
  const bytes = files[path] ?? files[decodeURIComponent(path)];
  return bytes ? decoder.decode(bytes) : null;
}

function extractTitle(opfXml: string): string | null {
  const m = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)
    ?? opfXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const text = htmlToText(m[1]!).trim();
  return text || null;
}

function matchTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>`, "gi");
  return xml.match(re) ?? [];
}

function matchAttr(xml: string, tag: string, attrName: string): string | null {
  const tagMatch = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>`, "i").exec(xml);
  return tagMatch ? attr(tagMatch[0], attrName) : null;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))
    ?? tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1]! : null;
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Resolve an OPF-relative href (handling ../, ./, %20, #fragment). */
function resolvePath(base: string, href: string): string {
  const clean = decodeURIComponent(href.split("#")[0]!);
  const parts = base ? base.split("/") : [];
  for (const seg of clean.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
