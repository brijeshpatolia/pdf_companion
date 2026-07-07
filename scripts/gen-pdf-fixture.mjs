// Generates a deterministic, valid 3-page PDF fixture with a known /Title,
// used by the real pdfMeta adapter test. Byte offsets for the xref table are
// computed programmatically so the file is guaranteed well-formed.
//
//   node scripts/gen-pdf-fixture.mjs
//
import { writeFileSync, mkdirSync } from "node:fs";

const objects = [
  `<< /Type /Catalog /Pages 2 0 R >>`,
  `<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>`,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>`,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>`,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>`,
  `<< /Title (Fixture: Three Page Book) /Author (PDF Companion tests) >>`,
];

const bytes = (s) => Buffer.byteLength(s, "latin1");

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets[i] = bytes(pdf);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = bytes(pdf);
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += `0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;
pdf += `startxref\n${xrefStart}\n%%EOF\n`;

const dir = new URL("../src/core/library/__fixtures__/", import.meta.url);
mkdirSync(dir, { recursive: true });
const out = new URL("three-page.pdf", dir);
writeFileSync(out, Buffer.from(pdf, "latin1"));
console.log(`wrote ${out.pathname} (${bytes(pdf)} bytes, 3 pages)`);
