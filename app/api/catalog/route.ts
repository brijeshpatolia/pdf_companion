import { NextResponse } from "next/server";
import { CATALOG, CATALOG_SOURCE } from "@/core/catalog/catalog.js";

export const runtime = "nodejs";

/** The curated public-domain catalog (static metadata). */
export function GET() {
  return NextResponse.json({ source: CATALOG_SOURCE, books: CATALOG });
}
