/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Desktop development server: rebuilds the browser bundle on change and serves it at
 * http://localhost:8080. Drive it with the keyboard: arrows, Enter = OK, Escape = Back,
 * r/g/y/b = colour keys, +/- = channel up/down, i = info, space = play/pause.
 *
 * It also provides /proxy?url=…, because a desktop browser blocks the cross-origin requests a
 * TV app makes freely (provider APIs, playlists, guides and stream segments).
 */
import * as esbuild from "esbuild";
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOptions, writeStatic } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist/browser");
const port = Number(process.env.PORT || 8080);

writeStatic("browser");
const ctx = await esbuild.context(buildOptions("browser", { dev: true }));
await ctx.watch();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function proxy(req, res, target, ua, redirects = 0) {
  let url;
  try {
    url = new URL(target);
  } catch {
    res.writeHead(400).end("bad url");
    return;
  }
  const lib = url.protocol === "https:" ? https : http;
  const upstream = lib.request(
    url,
    { method: "GET", headers: { "User-Agent": ua || "OpenTV-Lite/0.1", Accept: "*/*" } },
    (up) => {
      if (up.statusCode >= 300 && up.statusCode < 400 && up.headers.location && redirects < 5) {
        up.resume();
        proxy(req, res, new URL(up.headers.location, url).toString(), ua, redirects + 1);
        return;
      }
      const type = up.headers["content-type"] || "application/octet-stream";
      // HLS playlists reference segments by relative or absolute URL; rewrite them so the
      // player's follow-up requests come back through the proxy too.
      if (/mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(url.pathname)) {
        let body = "";
        up.setEncoding("utf8");
        up.on("data", (c) => (body += c));
        up.on("end", () => {
          // Only HLS media/master playlists are rewritten. An IPTV channel list is also "M3U"
          // and is served with the same content type, but it is data for the app, not the player.
          if (!/#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/.test(body)) {
            res.writeHead(up.statusCode, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
            res.end(body);
            return;
          }
          const rewritten = body
            .split("\n")
            .map((line) => {
              const l = line.trim();
              if (!l) return line;
              const wrap = (u) => "/proxy?url=" + encodeURIComponent(new URL(u, url).toString()) + (ua ? "&ua=" + encodeURIComponent(ua) : "");
              if (l.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${wrap(u)}"`);
              return wrap(l);
            })
            .join("\n");
          res.writeHead(up.statusCode, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
          res.end(rewritten);
        });
        return;
      }
      res.writeHead(up.statusCode, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
      up.pipe(res);
    },
  );
  upstream.on("error", (e) => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("proxy error: " + e.message);
  });
  req.on("close", () => upstream.destroy());
  upstream.end();
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname === "/proxy") {
      proxy(req, res, u.searchParams.get("url"), u.searchParams.get("ua"));
      return;
    }
    let file = join(out, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
    if (!file.startsWith(out) || !existsSync(file) || statSync(file).isDirectory()) file = join(out, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`OpenTV Lite dev server: http://localhost:${port}`));
