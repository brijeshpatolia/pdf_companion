// Generates a small text-rich PDF for demos/screenshots (the test fixture is
// intentionally blank). Usage: node scripts/gen-demo-pdf.mjs <outPath>
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "demo.pdf";
const doc = await PDFDocument.create();
doc.setTitle("The Last Days of Socrates");
doc.setAuthor("Plato");

const serif = await doc.embedFont(StandardFonts.TimesRoman);
const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
const ink = rgb(0.1, 0.12, 0.16);
const faint = rgb(0.4, 0.42, 0.48);

const pages = [
  {
    heading: "Phaedo",
    body: [
      "What actually happened, Phaedo, on the day when Socrates drank the poison",
      "in prison? Were you there with him yourself?",
      "",
      "I was there myself, Echecrates.",
      "",
      "Then what did the master say before he died, and how did he meet his end?",
      "I should be so glad to hear. None of us in Phlius travels to Athens much",
      "these days, and it is a long time since any visitor from there has been able",
      "to give us any definite account of what passed — beyond that he drank the",
      "poison and died. Of the rest they had nothing to tell.",
    ],
  },
  {
    heading: "On the Soul",
    body: [
      "Socrates: We believe, do we not, that death is the separation of the soul",
      "from the body — and that the state of being dead is when the body, released",
      "from the soul, exists alone by itself, and the soul, released from the body,",
      "exists alone by itself? Is death anything other than this?",
      "",
      "Simmias: No, it is just that.",
      "",
      "Socrates: Consider, then, whether you share my view; for this will help us",
      "learn more about the questions we are examining. Do you think it is proper",
      "for a philosopher to concern himself with the so-called pleasures of food",
      "and drink?",
    ],
  },
  {
    heading: "The Final Hour",
    body: [
      "When he had spoken, he got up and went into another room to take a bath,",
      "and Crito went with him, telling us to wait. So we waited, talking among",
      "ourselves about what had been said, and reviewing it again, and dwelling too",
      "on the greatness of our misfortune: it was as though we were losing a father",
      "and would be orphans for the rest of our lives.",
      "",
      "Such, Echecrates, was the end of our friend — a man, we would say, who",
      "was of all those we have known the best, and moreover the wisest and the",
      "most just.",
    ],
  },
];

for (const [i, p] of pages.entries()) {
  const page = doc.addPage([420, 560]);
  page.drawText(p.heading, { x: 56, y: 500, size: 22, font: serifBold, color: ink });
  let y = 460;
  for (const line of p.body) {
    if (line) page.drawText(line, { x: 56, y, size: 11, font: serif, color: ink });
    y -= 20;
  }
  page.drawText(String(i + 1), { x: 205, y: 32, size: 10, font: serif, color: faint });
}

writeFileSync(out, await doc.save());
console.log(`wrote ${out}`);
