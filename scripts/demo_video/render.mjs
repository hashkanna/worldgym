// Render every still the demo video needs into demo/build/: title cards, footage captions,
// the model table from the hosted findings page (three emphasis states), the contact sheets
// and the scorecard. Writes demo/build/shots.json with scroll targets for build.py.
//   node scripts/demo_video/render.mjs            (SITE=https://... to point at another deploy)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "demo", "build");
fs.mkdirSync(out, { recursive: true });
const scenes = JSON.parse(fs.readFileSync(path.join(here, "scenes.json"), "utf8"));
const site = (process.env.SITE || scenes.site).replace(/\/$/, "");
const cardsUrl = pathToFileURL(path.join(here, "cards.html")).href;
const shots = {};

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function renderCard(card, file, params = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const qs = new URLSearchParams({ card, ...params }).toString();
  await page.goto(`${cardsUrl}?${qs}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, omitBackground: card === "caption" });
  await page.close();
}

// title cards and captions
for (const beat of scenes.beats) {
  const v = beat.visual;
  if (v.type === "card") {
    const name = v.step ? `${v.card}-${v.step}` : v.card;
    await renderCard(v.card, path.join(out, `card-${name}.png`), v.step ? { step: String(v.step) } : {});
  }
  if (v.type === "footage") {
    await renderCard("caption", path.join(out, `caption-${beat.id}.png`), { eyebrow: v.eyebrow || "", text: v.caption || "" });
  }
}

// the model table, straight from the hosted findings page, in three emphasis states
const live = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2, colorScheme: "dark" });
await live.goto(`${site}/`, { waitUntil: "networkidle" });
if (!(await live.$(".models-wrap"))) throw new Error(`no model table (.models-wrap) on ${site}/`);
await live.evaluate(() => document.fonts.ready);
const dim = {
  none: "",
  good: "table.models tr > :nth-child(n+4) { opacity: .22 }",
  bad: "table.models tr > :nth-child(2), table.models tr > :nth-child(3), table.models tr > :nth-child(n+6) { opacity: .22 }",
};
for (const [state, css] of Object.entries(dim)) {
  await live.evaluate((css) => {
    let s = document.getElementById("demo-dim");
    if (!s) { s = document.createElement("style"); s.id = "demo-dim"; document.head.append(s); }
    s.textContent = css;
  }, css);
  const raw = path.join(out, `table-raw-${state}.png`);
  await live.locator(".models-wrap").screenshot({ path: raw });
  await renderCard("table", path.join(out, `table-${state}.png`), { img: pathToFileURL(raw).href });
}
await live.evaluate(() => document.getElementById("demo-dim")?.remove());

// contact sheets: the walk and turn sheets, as one tall strip to scroll through.
// Grow the viewport to the whole page so the clip is in plain viewport coordinates.
await live.setViewportSize({ width: 1100, height: Math.min(await live.evaluate(() => document.documentElement.scrollHeight), 7000) });
await live.evaluate(() => window.scrollTo(0, 0));
await live.waitForTimeout(300);
const clip = await live.evaluate(() => {
  const arts = [...document.querySelectorAll("article.sheet")];
  const pick = (re, i) => arts.find((a) => re.test(a.querySelector("h3")?.textContent || "")) || arts[i];
  const a = pick(/walk forward and back/i, 1).getBoundingClientRect();
  const b = pick(/turn away and back/i, 2).getBoundingClientRect();
  const sec = arts[0].closest("section").getBoundingClientRect();
  return { x: Math.max(0, sec.left - 12), y: a.top - 24, width: sec.width + 24, height: b.bottom - a.top + 48 };
});
await live.screenshot({ path: path.join(out, "sheets.png"), clip });
shots.sheets = { bg: "#111325", from: 0, to: "end" };
await live.close();

// scorecard: header down to the By model table (demo videos hidden; they screenshot as black boxes)
const dash = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5 });
await dash.goto(`${site}/dashboard/`, { waitUntil: "networkidle" });
const target = await dash.evaluate(() => {
  for (const v of document.querySelectorAll("video")) v.closest(".card")?.remove();
  for (const h of document.querySelectorAll("h2")) {
    if (/exhibits/i.test(h.textContent) && h.nextElementSibling && !h.nextElementSibling.querySelector(".card")) {
      h.nextElementSibling.remove();
      h.remove();
    }
  }
  window.scrollTo(0, 0);
  const byModel = [...document.querySelectorAll("h2")].find((h) => /by model/i.test(h.textContent));
  const table = byModel?.nextElementSibling;
  const top = byModel ? byModel.getBoundingClientRect().top : 0;
  const bottom = table ? table.getBoundingClientRect().bottom : top + 600;
  return { top, bottom };
});
const dashHeight = Math.ceil(Math.max(target.bottom + 80, 1080 / 1.5));
await dash.setViewportSize({ width: 1280, height: Math.min(dashHeight, 6000) });
await dash.waitForTimeout(300);
await dash.screenshot({ path: path.join(out, "dashboard.png"), clip: { x: 0, y: 0, width: 1280, height: Math.min(dashHeight, 6000) } });
// end with the By model table in view: its bottom (plus margin) at the bottom of the frame
shots.dashboard = { bg: "#0e0f12", from: 0, to: Math.max(0, Math.round((target.bottom + 60) * 1.5 - 1080)) };
await dash.close();

fs.writeFileSync(path.join(out, "shots.json"), JSON.stringify(shots, null, 2));
await browser.close();
console.log("stills ->", out);
