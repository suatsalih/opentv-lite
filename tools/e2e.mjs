/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * End-to-end acceptance run of the browser build, driven only by remote-control keys.
 * Expects `npm run mock` (port 8090) and `npm run dev` (port 8080) to be running.
 * Saves a screenshot of every step to e2e-shots/ and exits non-zero on the first failure.
 *
 * Usage: node tools/e2e.mjs [--xtream|--m3u]
 */
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";

const APP = process.env.APP_URL || "http://localhost:8080";
const MOCK = process.env.MOCK_URL || "http://localhost:8090";
const mode = process.argv.includes("--m3u") ? "m3u" : "xtream";
const shots = "e2e-shots/" + mode;
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

let step = 0;
async function shot(name) {
  step++;
  await page.screenshot({ path: `${shots}/${String(step).padStart(2, "0")}-${name}.png` });
}
async function press(...keys) {
  for (const k of keys) {
    await page.keyboard.press(k);
    await page.waitForTimeout(120);
  }
}
async function expectText(selector, pattern, what) {
  try {
    await page.waitForFunction(
      ([sel, src]) => {
        const el = document.querySelector(sel);
        return !!el && new RegExp(src).test(el.textContent || "");
      },
      [selector, pattern.source],
      { timeout: 15000 },
    );
  } catch {
    await shot("FAILED-" + what.replace(/\W+/g, "-"));
    const actual = await page.evaluate((sel) => (document.querySelector(sel) || {}).textContent, selector);
    throw new Error(`${what}: expected ${selector} to match ${pattern}, got ${JSON.stringify(actual)}`);
  }
  console.log("  ✓ " + what);
}
async function typeInto(text) {
  await press("Enter"); // OK opens the field (the TV keyboard on a real set)
  await page.keyboard.type(text);
  await press("Enter"); // Done: closes the field and moves to the next one
}

console.log(`Acceptance run (${mode}) against ${APP}`);
await page.goto(APP);
await page.evaluate(() => localStorage.clear());
await page.reload();

// 1. Onboarding
await expectText(".screen-title", /Welcome to OpenTV Lite/, "first launch opens onboarding");
await shot("onboarding");

// 2. Add the mock provider with the remote
if (mode === "xtream") {
  await typeInto(MOCK + "/get.php?username=demo&password=demo&type=m3u_plus"); // pasted link fills the login
  await expectText(".form", /.*/, "server field accepted");
  await press("ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown"); // → buttons
} else {
  await press("ArrowUp", "ArrowRight"); // up to the provider-type switch, then M3U
  await press("ArrowDown");
  await typeInto(MOCK + "/get.php?username=demo&password=demo&type=m3u_plus");
  await press("ArrowDown", "ArrowDown"); // → buttons
}
await shot("form-filled");
await press("Enter");

// 3. Guide
await expectText(".info-channel", /\w/, "guide opens with a channel highlighted");
await expectText(".cats", /Favourites[\s\S]*All channels[\s\S]*UK \| ENTERTAINMENT/, "categories listed");
await expectText(".guide-rows", /BBC One/, "channel rows rendered");
await expectText(".guide-rows", /News at Six|EastEnders|Mastermind|Only Connect|Panorama/, "programme guide loaded");
await page.waitForTimeout(2500);
await shot("guide");

// Real providers send H.264, which Playwright's Chromium cannot decode; run the mock with
// MOCK_CODEC=vp9 for these checks. Set SKIP_PLAYBACK=1 to run the UI checks alone.
async function expectVideoPlaying(what) {
  if (process.env.SKIP_PLAYBACK) return;
  try {
    // Playing, advancing, and actually showing a picture (the test card is bright, not black).
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
    }, null, { timeout: 20000, polling: 500 });
  } catch {
    await shot("FAILED-" + what.replace(/\W+/g, "-"));
    const msg = await page.evaluate(() => {
      const el = document.querySelector(".preview-error, .player-error");
      const v = document.querySelector("video");
      const state = v ? `ready=${v.readyState} net=${v.networkState} t=${v.currentTime} paused=${v.paused} w=${v.videoWidth}` : "no video element";
      return (el ? el.textContent : "no error shown") + "; " + state;
    });
    throw new Error(`${what}: video is not playing (${msg})`);
  }
  console.log("  ✓ " + what);
}
await expectVideoPlaying("preview plays the highlighted channel");
await shot("guide-playing");

// 4. Move around the guide
await press("ArrowDown", "ArrowDown");
await expectText(".info-channel", /ITV1/, "down moves to the third channel");
await press("ArrowRight", "ArrowRight");
await expectText(".prog.focused", /\w/, "right moves into future programmes");
await shot("guide-future");
await press("Escape");
await press("y");
await expectText(".chan.focused .chan-star", /.*/, "yellow toggles favourite");
await shot("favourite");

// 5. Full screen and zapping
await press("Enter");
await expectText(".banner-name", /ITV1/, "OK opens full-screen player");
await expectVideoPlaying("full-screen video plays");
await shot("player");
await press("ArrowUp");
await expectText(".banner-name", /BBC Two/, "up zaps to previous channel");
await press("Escape");
await expectText(".info-channel", /BBC Two/, "Back returns to the guide on the same channel");

// 6. Favourites category
await press("ArrowLeft", "ArrowUp", "ArrowUp", "ArrowUp", "Enter");
await expectText(".guide-rows", /ITV1/, "favourites category shows the starred channel");
await shot("favourites");

// 7. Settings and About through the rail
await press("ArrowLeft", "ArrowLeft", "ArrowDown", "Enter");
await expectText(".screen-title", /Settings/, "rail opens settings");
await expectText(".settings-body", /Channels: 14/, "provider listed with channel count");
await shot("settings");
await press("ArrowDown", "ArrowDown", "Enter");
await expectText(".about-col", /suat\.salih@gmail\.com/, "about shows the PayPal address");
await expectText(".about-columns", /github\.com\/suatsalih\/opentv-lite/, "about shows the repo");
await shot("about");
await press("Escape", "Escape");
await expectText(".info-channel", /\w/, "back to live TV");

// 8. Survives a restart without re-adding the provider
await page.reload();
await expectText(".guide-rows", /BBC One|ITV1/, "reopens on the guide after restart");
await shot("after-restart");

await browser.close();
if (errors.length) {
  console.error("Page errors:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log(`All steps passed. Screenshots in ${shots}/`);
