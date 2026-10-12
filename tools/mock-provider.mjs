/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * A fake IPTV provider for testing without a real subscription. Serves, on port 8090:
 *
 *   Xtream API   http://localhost:8090  username "demo", password "demo"
 *   M3U          http://localhost:8090/get.php?username=demo&password=demo&type=m3u_plus
 *   XMLTV        http://localhost:8090/xmltv.php  (gzipped with ?gz=1)
 *   Live HLS     /live/demo/demo/<id>.m3u8 — a never-ending live playlist per channel
 *
 * Video is generated once with ffmpeg (a test card) into tools/.media. Real providers send
 * H.264, which TVs decode but Playwright's open-source Chromium cannot; MOCK_CODEC=vp9 serves
 * VP9/Opus in fMP4 instead, so automated runs can check that pictures actually play.
 * Usage: npm run mock   (or MOCK_CODEC=vp9 npm run mock)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const media = join(here, ".media");
const port = Number(process.env.MOCK_PORT || 8090);
const SEGMENT_SECONDS = 2;
// Five minutes of continuous video. A real channel never jumps back in time; looping a short
// clip makes the live window hit a discontinuity every few seconds, which is not what TVs see.
const SEGMENTS = 150;
const VP9 = process.env.MOCK_CODEC === "vp9";

export const CATEGORIES = [
  { category_id: "1", category_name: "UK | ENTERTAINMENT" },
  { category_id: "2", category_name: "UK | NEWS" },
  { category_id: "3", category_name: "SPORTS" },
  { category_id: "4", category_name: "KIDS" },
];

const NAMES = [
  ["BBC One", "1"], ["BBC Two", "1"], ["ITV1", "1"], ["Channel 4", "1"], ["Channel 5", "1"],
  ["Sky News", "2"], ["BBC News", "2"], ["Al Jazeera", "2"],
  ["Sky Sports Main Event", "3"], ["TNT Sports 1", "3"], ["Eurosport 1", "3"],
  ["CBeebies", "4"], ["Cartoon Network", "4"], ["Nickelodeon", "4"],
];

export const CHANNELS = NAMES.map(([name, cat], i) => ({
  num: 100 + i,
  name,
  stream_id: String(1000 + i),
  stream_icon: "",
  epg_channel_id: name.replace(/\s+/g, "").toLowerCase() + ".uk",
  category_id: cat,
  tv_archive: i < 3 ? 1 : 0,
  tv_archive_duration: i < 3 ? 7 : 0,
}));

const SHOWS = ["News at Six", "EastEnders", "Mastermind", "Only Connect", "Panorama", "Gardeners' World",
  "Match of the Day", "The Chase", "Pointless", "Bake Off", "Countdown", "Doctor Who", "Top Gear"];

function ensureMedia() {
  const duration = String(SEGMENT_SECONDS * SEGMENTS);
  const sources = ["-f", "lavfi", "-i", `testsrc2=size=960x540:rate=25:duration=${duration}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`];
  if (!existsSync(join(media, `seg-${SEGMENTS - 1}.ts`)) || existsSync(join(media, `seg-${SEGMENTS}.ts`))) {
    mkdirSync(media, { recursive: true });
    console.log("Generating H.264 test video (one-off)…");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...sources,
      "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-g", "50", "-keyint_min", "50", "-sc_threshold", "0",
      "-c:a", "aac", "-b:a", "96k",
      "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-segment_format", "mpegts",
      join(media, "seg-%d.ts")]);
  }
  if (VP9 && !existsSync(join(media, "vp9", "v3"))) {
    mkdirSync(join(media, "vp9"), { recursive: true });
    console.log("Generating VP9 test video (one-off)…");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...sources,
      // No alt-ref/lookahead frames, so every 2 s segment starts on a decodable keyframe.
      "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "800k", "-g", "50", "-keyint_min", "50",
      "-auto-alt-ref", "0", "-lag-in-frames", "0",
      "-c:a", "libopus", "-b:a", "64k",
      "-f", "hls", "-hls_time", String(SEGMENT_SECONDS), "-hls_playlist_type", "vod", "-hls_segment_type", "fmp4",
      "-hls_fmp4_init_filename", "init.mp4", "-hls_segment_filename", join(media, "vp9", "seg-%d.m4s"),
      join(media, "vp9", "index.m3u8")]);
    writeFileSync(join(media, "vp9", "v3"), ""); // marks media made with the current settings
  }
}

function livePlaylist() {
  // A sliding window over the looping segments, advancing with the wall clock like real live TV.
  const seq = Math.floor(Date.now() / 1000 / SEGMENT_SECONDS);
  const lines = ["#EXTM3U", `#EXT-X-VERSION:${VP9 ? 7 : 3}`, `#EXT-X-TARGETDURATION:${SEGMENT_SECONDS}`,
    `#EXT-X-MEDIA-SEQUENCE:${seq}`, `#EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(seq / SEGMENTS)}`];
  if (VP9) lines.push('#EXT-X-MAP:URI="/vp9/init.mp4"');
  for (let n = seq; n < seq + 4; n++) {
    if (n % SEGMENTS === 0 && n !== seq) {
      lines.push("#EXT-X-DISCONTINUITY");
      if (VP9) lines.push('#EXT-X-MAP:URI="/vp9/init.mp4"');
    }
    lines.push(`#EXTINF:${SEGMENT_SECONDS}.0,`, VP9 ? `/vp9/seg-${n % SEGMENTS}.m4s` : `/seg/${n % SEGMENTS}.ts`);
  }
  return lines.join("\n") + "\n";
}

function xmltv(now = Date.now()) {
  const fmt = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00 +0000`;
  };
  const start = Math.floor(now / 1800000) * 1800000 - 4 * 3600000;
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="opentv-lite-mock">\n';
  for (const ch of CHANNELS) out += `  <channel id="${ch.epg_channel_id}"><display-name>${ch.name}</display-name></channel>\n`;
  CHANNELS.forEach((ch, ci) => {
    let t = start;
    let k = ci;
    while (t < now + 30 * 3600000) {
      const len = (k % 3 === 0 ? 60 : 30) * 60000;
      const title = SHOWS[k % SHOWS.length];
      out += `  <programme start="${fmt(t)}" stop="${fmt(t + len)}" channel="${ch.epg_channel_id}">` +
        `<title lang="en">${title}</title><desc lang="en">${title} on ${ch.name} — episode ${(k % 9) + 1} &amp; more.</desc></programme>\n`;
      t += len;
      k++;
    }
  });
  return out + "</tv>\n";
}

function m3u() {
  const base = `http://localhost:${port}`;
  let out = `#EXTM3U url-tvg="${base}/xmltv.php"\n`;
  for (const ch of CHANNELS) {
    const group = CATEGORIES.find((c) => c.category_id === ch.category_id).category_name;
    out += `#EXTINF:-1 tvg-id="${ch.epg_channel_id}" tvg-chno="${ch.num}" group-title="${group}",${ch.name}\n`;
    out += `${base}/live/demo/demo/${ch.stream_id}.m3u8\n`;
  }
  return out;
}

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  res.end(body);
}

export function startMock() {
  ensureMedia();
  return http
    .createServer((req, res) => {
      const u = new URL(req.url, "http://localhost");
      const q = u.searchParams;
      const authed = q.get("username") === "demo" && q.get("password") === "demo";
      if (u.pathname === "/player_api.php") {
        if (!authed) return send(res, 200, "application/json", JSON.stringify({ user_info: { auth: 0 } }));
        const action = q.get("action");
        if (!action)
          return send(res, 200, "application/json", JSON.stringify({
            user_info: { username: "demo", auth: 1, status: "Active", exp_date: String(Math.floor(Date.now() / 1000) + 86400 * 30), max_connections: "1", active_cons: "0" },
            server_info: { timezone: "Europe/London" },
          }));
        if (action === "get_live_categories") return send(res, 200, "application/json", JSON.stringify(CATEGORIES));
        if (action === "get_live_streams") return send(res, 200, "application/json", JSON.stringify(CHANNELS));
        return send(res, 200, "application/json", "[]");
      }
      if (u.pathname === "/xmltv.php") {
        const xml = xmltv();
        if (q.get("gz") === "1") return send(res, 200, "application/gzip", gzipSync(xml));
        return send(res, 200, "application/xml", xml);
      }
      if (u.pathname === "/get.php") return authed ? send(res, 200, "audio/x-mpegurl", m3u()) : send(res, 403, "text/plain", "forbidden");
      if (/^\/(live|timeshift)\//.test(u.pathname)) {
        if (!u.pathname.includes("/demo/demo/")) return send(res, 403, "text/plain", "forbidden");
        if (u.pathname.endsWith(".m3u8")) return send(res, 200, "application/vnd.apple.mpegurl", livePlaylist());
        return send(res, 200, "video/mp2t", readFileSync(join(media, "seg-0.ts")));
      }
      const vp9 = /^\/vp9\/(init\.mp4|seg-\d+\.m4s)$/.exec(u.pathname);
      if (vp9) return send(res, 200, "video/mp4", readFileSync(join(media, "vp9", vp9[1])));
      const seg = /^\/seg\/(\d+)\.ts$/.exec(u.pathname);
      if (seg) return send(res, 200, "video/mp2t", readFileSync(join(media, `seg-${seg[1]}.ts`)));
      send(res, 404, "text/plain", "not found");
    })
    .listen(port, () => console.log(`Mock provider on http://localhost:${port}  (username demo / password demo)`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startMock();
