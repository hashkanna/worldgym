// Record a scripted drive through the WorldXR page straight off the incoming WebRTC track.
// usage: node record.mjs <out.webm> <anchor value, "" = prompt only> ["prompt"]
import { chromium } from "playwright-core";
import fs from "node:fs";

const [OUT, ANCHOR = "anchors/room.jpg", PROMPT] = process.argv.slice(2);
fs.writeFileSync(OUT, Buffer.alloc(0));

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.exposeFunction("__saveChunk", (b64) => fs.appendFileSync(OUT, Buffer.from(b64, "base64")));
await page.goto("http://localhost:8000/");
await page.$eval("#anchor", (el, v) => { el.value = v; }, ANCHOR);
if (PROMPT) await page.$eval("#prompt", (el, v) => { el.value = v; }, PROMPT);

// Reactor is often out of capacity today: retry until a session starts
for (let attempt = 1; ; attempt++) {
  await page.$eval("#log", (el) => { el.textContent = ""; });
  await page.click("#connect");
  const state = await page.waitForFunction(() => {
    const t = document.getElementById("log").textContent;
    if (/connect failed|start failed|token error/.test(t)) return "failed";
    return /started/.test(t) && document.getElementById("video").videoWidth > 0 ? "ok" : false;
  }, null, { timeout: 120000, polling: 500 }).then((h) => h.jsonValue());
  if (state === "ok") break;
  console.log(`attempt ${attempt}: ${(await page.$eval("#log", (el) => el.textContent)).trim().split("\n").pop()}`);
  if (attempt >= 30) throw new Error("gave up waiting for Reactor capacity");
  await page.waitForTimeout(10000);
}
console.log("session started");
await page.waitForTimeout(2000);

await page.evaluate(() => {
  const rec = new MediaRecorder(document.getElementById("video").srcObject, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 8_000_000 });
  window.__q = Promise.resolve();
  rec.ondataavailable = (e) => {
    if (!e.data.size) return;
    window.__q = window.__q.then(async () => {
      const buf = new Uint8Array(await e.data.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      await window.__saveChunk(btoa(s));
    });
  };
  rec.start(1000);
  window.__rec = rec;
});

await page.mouse.click(1000, 600); // focus the page, away from the UI panel
const hold = async (key, ms) => {
  if (key) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  if (key) await page.keyboard.up(key);
  console.log(`  ${key || "idle"} ${ms / 1000}s`);
};
await hold(null, 3000);         // take in the anchor
await hold("w", 6000);          // walk in
await hold("ArrowLeft", 6000);  // look around
await hold("ArrowRight", 8000);
await hold("s", 4000);
await hold(null, 5000);         // let the command lag play out

await page.evaluate(() => new Promise((res) => { window.__rec.onstop = () => res(); window.__rec.stop(); }));
await page.evaluate(() => window.__q);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
await browser.close();
