/**
 * Screenshots a page turn frame by frame, so it can be looked at rather than
 * assumed. Not part of the test suite — the suite checks behaviour, and this
 * is for judging whether the thing reads as paper.
 *
 *   node scripts/shoot-page-turn.mjs [outDir]
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2] || "/tmp/page-turn";
const css = await readFile("app/globals.css", "utf8");

const PROSE = `Every limit is a beginning as well as an ending. Who can quit young
lives after being long in company with them, and not desire to know what
befell them in their after-years? For the fragment of a life, however
typical, is not the sample of an even web.`;

const page_ = (n, text) => `
  <div class="paper-running-head"><span>Middlemarch</span><span class="tabular">${n}</span></div>
  <div class="epub-page"><p>${text}</p></div>`;

const html = `
<style>${css}</style>
<section class="pane-book" style="height:100vh">
  <div class="page-stage">
    <div class="paper reader-paper is-text" id="paper">${page_(88, PROSE)}</div>
    <div class="page-leaf" id="slot">
      <div class="paper reader-paper is-text leaf" id="leaf">
        ${page_(87, "It is a narrow mind which cannot look at a subject from various points of view.")}
        <div class="leaf-shade"></div>
      </div>
    </div>
  </div>
</section>`;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });

for (const [name, setup] of [
  ["forward", "leaf.className += ' leaf-forward'"],
  ["back", "leaf.className += ' leaf-back'; slot.className += ' is-behind'; paper.className += ' is-arriving'"],
]) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 880 } });
  await page.setContent(html);
  await page.evaluate(`(() => {
    const paper = document.getElementById('paper');
    const leaf = document.getElementById('leaf');
    const slot = document.getElementById('slot');
    ${setup};
  })()`);

  for (const at of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) {
    await page.evaluate((fraction) => {
      for (const a of document.getAnimations()) {
        a.pause();
        const duration = Number(a.effect?.getTiming().duration ?? 0);
        a.currentTime = duration * fraction;
      }
    }, at);
    const file = path.join(out, `${name}-${String(Math.round(at * 100)).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
  }
  await page.close();
}

await browser.close();
console.log(`wrote frames to ${out}`);
