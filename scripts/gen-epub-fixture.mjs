// Generates a deterministic, valid EPUB fixture (mimetype + container.xml +
// OPF package + two XHTML chapters) used by the EPUB parser tests.
//
//   node scripts/gen-epub-fixture.mjs
//
import { zipSync, strToU8 } from "fflate";
import { writeFileSync, mkdirSync } from "node:fs";

const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>The Nature of the Forms</dc:title>
    <dc:creator>Plato (fixture)</dc:creator>
    <dc:identifier id="bookid">urn:uuid:pdf-companion-epub-fixture</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

const ch1 = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title>
<style>.x{color:red}</style></head>
<body>
  <h1>Chapter&#160;One</h1>
  <p>The <em>Theory of Forms</em> holds that abstract ideals are more real
  than the physical things that imitate them &mdash; a claim with a long tail.</p>
  <p>Consider a triangle drawn in sand: imperfect, yet it points at a perfect
  Form no drawing can capture.</p>
  <script>console.log("should be stripped")</script>
</body></html>`;

// A deliberately long chapter so pagination splits it into multiple pages.
const longBody = Array.from({ length: 40 }, (_, i) =>
  `<p>Paragraph ${i + 1}: the soul recollects the Forms it knew before birth, and learning is the slow remembering of what was always, in some sense, already known.</p>`,
).join("\n  ");

const ch2 = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 2</title></head>
<body>
  <h1>Chapter Two</h1>
  ${longBody}
</body></html>`;

// mimetype must be the first entry and stored uncompressed (level 0).
const zip = zipSync(
  {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(container),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/ch1.xhtml": strToU8(ch1),
    "OEBPS/text/ch2.xhtml": strToU8(ch2),
  },
  { level: 6 },
);

const dir = new URL("../src/core/epub/__fixtures__/", import.meta.url);
mkdirSync(dir, { recursive: true });
const out = new URL("sample.epub", dir);
writeFileSync(out, zip);
console.log(`wrote ${out.pathname} (${zip.length} bytes)`);
