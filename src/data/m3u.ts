/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { Category, Channel } from "./models";

/**
 * M3U/M3U8 playlist parser, ported from OpenTV's `M3uParser`.
 *
 * Tolerant by design: a malformed entry is skipped, not fatal — one bad line in a
 * 40,000-line playlist must never cost the user their entire channel list.
 */
export interface M3uResult {
  channels: Channel[];
  categories: Category[];
  /** Value of `url-tvg` / `x-tvg-url` on the `#EXTM3U` header, if declared. */
  declaredEpgUrl?: string;
  skipped: number;
}

const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

export function parseM3u(text: string, sourceId: string): M3uResult {
  const channels: Channel[] = [];
  const categories: Category[] = [];
  const seenCategories: Record<string, true> = {};
  const seenStreamIds: Record<string, true> = {};
  let declaredEpgUrl: string | undefined;
  let skipped = 0;

  let pendingName: string | undefined;
  let pendingAttrs: Record<string, string> = {};

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^#EXTM3U/i.test(line)) {
      const attrs = parseAttributes(line);
      declaredEpgUrl = attrs["url-tvg"] || attrs["x-tvg-url"] || declaredEpgUrl;
    } else if (/^#EXTINF/i.test(line)) {
      pendingAttrs = parseAttributes(line);
      pendingName = displayNameOf(line, pendingAttrs);
    } else if (line.charAt(0) === "#") {
      // Any other directive: ignore, but keep the pending EXTINF alive.
    } else {
      if (!pendingName) {
        // A URL with no preceding #EXTINF. Nothing sensible to label it with.
        skipped++;
      } else {
        const tvgId = nonBlank(pendingAttrs["tvg-id"]);
        const streamId = tvgId ? "tvg:" + tvgId : "url:" + stableHash(line);
        // Providers repeat the same tvg-id across quality variants: keep the first.
        if (!seenStreamIds[streamId]) {
          seenStreamIds[streamId] = true;
          const group = nonBlank(pendingAttrs["group-title"]);
          if (group && !seenCategories[group]) {
            seenCategories[group] = true;
            categories.push({ id: group, name: group });
          }
          const chno = parseInt(pendingAttrs["tvg-chno"] || "", 10);
          channels.push({
            key: sourceId + ":" + streamId,
            sourceId,
            streamId,
            name: pendingName,
            categoryId: group,
            logoUrl: nonBlank(pendingAttrs["tvg-logo"]) || nonBlank(pendingAttrs["logo"]),
            epgChannelId: tvgId,
            number: isNaN(chno) ? undefined : chno,
            streamUrl: line,
            tvArchive: false,
            tvArchiveDays: 0,
          });
        }
      }
      pendingName = undefined;
      pendingAttrs = {};
    }
  }
  return { channels, categories, declaredEpgUrl, skipped };
}

/**
 * The display name is whatever follows the last comma on the #EXTINF line. Falling back to
 * `tvg-name` matters because plenty of playlists emit `#EXTINF:-1 ...,` with nothing after.
 */
function displayNameOf(line: string, attrs: Record<string, string>): string | undefined {
  // Attribute values may contain commas, so look for the comma after the last attribute.
  const withoutAttrs = line.replace(ATTRIBUTE, "");
  const comma = withoutAttrs.lastIndexOf(",");
  const after = comma >= 0 ? withoutAttrs.slice(comma + 1).trim() : "";
  return after || nonBlank(attrs["tvg-name"]);
}

function parseAttributes(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTRIBUTE.exec(line))) out[m[1].toLowerCase()] = m[2];
  return out;
}

function nonBlank(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** FNV-1a (32-bit, two lanes) — stable across launches, unlike object identity. */
export function stableHash(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16) + b.toString(16);
}
