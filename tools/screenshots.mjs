/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Regenerates the README screenshots in docs/screenshots/ from the real app, driven with the
 * remote against the fake provider. Run whenever the UI changes:
 *
 *   MOCK_CODEC=vp9 npm run mock &   npm run dev &   node tools/screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const APP = process.env.APP_URL || "http://localhost:8080";
const MOCK = process.env.MOCK_URL || "http://localhost:8090";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

async function press(...keys) {
  for (const k of keys) {
    await page.keyboard.press(k);
    await page.waitForTimeout(150);
  }
}
async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("  saved " + name);
}
/** Waits until the video shows a real (non-black) picture. */
async function videoShowing() {
  await page.waitForFunction(() => {
    const v = document.querySelector("video");
    if (!v || v.currentTime < 1 || v.paused || !v.videoWidth) return false;
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 18;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, 32, 18);
    const d = ctx.getImageData(0, 0, 32, 18).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4) / 3 > 40;
  }, null, { timeout: 30000, polling: 500 });
}

await page.goto(APP);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector(".form");
await page.waitForTimeout(500);
await shot("01-welcome");

// Add the fake provider: the pasted link fills in the login.
await page.keyboard.type(MOCK + "/get.php?username=demo&password=demo&type=m3u_plus");
await press("Enter", "ArrowDown", "ArrowDown", "ArrowDown"); // → Name
await page.keyboard.type("My provider");
await press("Enter", "ArrowDown", "Enter"); // → Guide URL → Connect
await page.waitForSelector(".guide-rows .prog-title", { timeout: 30000 });
await videoShowing();
await page.waitForTimeout(500);
await shot("02-live-tv");

await press("ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight");
await page.waitForTimeout(800);
await shot("03-guide");

await press("Escape", "y", "ArrowUp", "y", "Enter");
await videoShowing();
await press("Enter"); // OK shows the channel banner
await page.waitForTimeout(400);
await shot("04-full-screen");

await press("Escape", "ArrowLeft", "ArrowLeft", "ArrowDown", "Enter");
await page.waitForSelector(".settings-body");
await shot("05-settings");

await press("ArrowDown", "ArrowDown", "Enter");
await page.waitForSelector(".about-qr");
await shot("06-about");

await browser.close();
