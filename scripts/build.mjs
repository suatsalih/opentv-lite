/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Builds one folder per platform under dist/:
 *   dist/browser  — for desktop testing (npm run dev serves this)
 *   dist/tizen    — a Tizen web app; package and sign it with the Tizen CLI (see README)
 *   dist/webos    — a webOS app; package it with `ares-package dist/webos` (see README)
 *
 * The same source is compiled three times with a different __PLATFORM__ constant, so each
 * bundle carries only its own platform's code. Output targets Chromium 53, the browser engine
 * of 2018 LG TVs (Samsung 2018 is Chromium 56), and is a classic script, not an ES module,
 * because those engines cannot load module scripts.
 */
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

export const PLATFORMS = ["browser", "tizen", "webos"];

/** hls.js is only needed by the desktop browser build; TVs play HLS natively. */
const stubHls = {
  name: "stub-hls",
  setup(build) {
    build.onResolve({ filter: /^hls\.js$/ }, () => ({ path: "hls-stub", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export default { isSupported: function () { return false; } };",
      loader: "js",
    }));
  },
};

export function buildOptions(platform, { dev = false } = {}) {
  return {
    entryPoints: [join(root, "src/main.tsx")],
    outfile: join(root, "dist", platform, "app.js"),
    bundle: true,
    format: "iife",
    target: ["chrome53"],
    jsx: "automatic",
    jsxImportSource: "preact",
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    legalComments: "none",
    define: { __PLATFORM__: JSON.stringify(platform) },
    plugins: platform === "browser" ? [] : [stubHls],
    logLevel: "warning",
  };
}

export function writeStatic(platform) {
  const out = join(root, "dist", platform);
  mkdirSync(out, { recursive: true });
  let html = readFileSync(join(root, "src/index.html"), "utf8");
  // Samsung's device APIs (AVPlay, key registration) come from a script the TV provides.
  const head = platform === "tizen" ? '<script src="$WEBAPIS/webapis/webapis.js"></script>' : "";
  html = html.replace("<!--PLATFORM_HEAD-->", head);
  writeFileSync(join(out, "index.html"), html);

  if (platform === "tizen") {
    const config = readFileSync(join(root, "platforms/tizen/config.xml"), "utf8").replace(/@VERSION@/g, pkg.version);
    writeFileSync(join(out, "config.xml"), config);
    cpSync(join(root, "platforms/tizen/icon.png"), join(out, "icon.png"));
  }
  if (platform === "webos") {
    const info = JSON.parse(readFileSync(join(root, "platforms/webos/appinfo.json"), "utf8"));
    info.version = pkg.version;
    writeFileSync(join(out, "appinfo.json"), JSON.stringify(info, null, 2));
    for (const f of ["icon.png", "largeIcon.png", "splash.png"]) cpSync(join(root, "platforms/webos", f), join(out, f));
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => PLATFORMS.includes(a));
  const targets = only.length ? only : PLATFORMS;
  for (const platform of targets) {
    rmSync(join(root, "dist", platform), { recursive: true, force: true });
    await esbuild.build(buildOptions(platform));
    writeStatic(platform);
    const size = readFileSync(join(root, "dist", platform, "app.js")).length;
    console.log(`built dist/${platform}  (app.js ${(size / 1024).toFixed(0)} KB)`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
