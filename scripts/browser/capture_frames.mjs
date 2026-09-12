// Drive the WorldXR page in headless Chrome, save native-resolution frames + WebRTC video stats.
// usage: node capture.mjs <outDir> <anchor value, "" = prompt only>
import { chromium } from "playwright-core";
import fs from "node:fs";

const OUT = process.argv[2];
const ANCHOR = process.argv[3] ?? "anchors/room.jpg";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`[console.${m.type()}]`, m.text().slice(0, 300)); });

// keep a handle on peer connections so we can read inbound video stats
await page.addInitScript(() => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...a) { const pc = new Orig(...a); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Orig);
});

const stats = () => page.evaluate(async () => {
  const v = document.getElementById("video");
  const out = { videoWidth: v.videoWidth, videoHeight: v.videoHeight, t: performance.now() };
  for (const pc of window.__pcs || []) {
    const r = await pc.getStats();
    const codecs = {};
    r.forEach((s) => { if (s.type === "codec") codecs[s.id] = s.mimeType; });
    r.forEach((s) => {
      if (s.type === "inbound-rtp" && s.kind === "video") Object.assign(out, {
        frameWidth: s.frameWidth, frameHeight: s.frameHeight, fps: s.framesPerSecond, codec: codecs[s.codecId],
        bytesReceived: s.bytesReceived, framesDecoded: s.framesDecoded, framesDropped: s.framesDropped,
        qpAvg: s.framesDecoded && s.qpSum ? +(s.qpSum / s.framesDecoded).toFixed(1) : undefined,
        packetsLost: s.packetsLost, decoder: s.decoderImplementation,
      });
      if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") out.rttMs = Math.round((s.currentRoundTripTime || 0) * 1000);
    });
  }
  return out;
});

let prev = null;
const grab = async (tag) => {
  const dataUrl = await page.evaluate(() => {
    const v = document.getElementById("video");
    if (!v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return c.toDataURL("image/png");
  });
  if (dataUrl) fs.writeFileSync(`${OUT}/${tag}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
  const s = await stats();
  if (prev?.bytesReceived != null && s.bytesReceived != null) s.kbps = Math.round(((s.bytesReceived - prev.bytesReceived) * 8) / ((s.t - prev.t) / 1000) / 1000);
  prev = s;
  const { t, bytesReceived, ...show } = s;
  console.log(tag.padEnd(16), JSON.stringify(show));
};

await page.goto("http://localhost:8000/");
await page.$eval("#anchor", (el, v) => { el.value = v; }, ANCHOR);
const t0 = Date.now();
await page.click("#connect");
try {
  await page.waitForFunction(() => /started|failed|ERROR|token error/.test(document.getElementById("log").textContent), null, { timeout: 120000 });
  await page.waitForFunction(() => document.getElementById("video").videoWidth > 0, null, { timeout: 60000 });
  console.log(`first frame after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.waitForTimeout(3000);
  await grab("0_idle");
  await page.mouse.click(1000, 600); // focus the page, away from the UI panel
  await page.keyboard.down("w"); await page.waitForTimeout(4000); await grab("1_forward_4s"); await page.keyboard.up("w");
  await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(4000); await grab("2_lookleft_4s"); await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(3000); await grab("3_idle_again");
  await page.screenshot({ path: `${OUT}/page.png` });
} catch (e) {
  console.log("run failed:", e.message.split("\n")[0]);
}
console.log("--- page log ---\n" + (await page.$eval("#log", (el) => el.textContent)));
await browser.close();
