/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { SourceKind } from "./models";

/**
 * Users paste all sorts of things. Accept them all rather than making someone guess the
 * format: a trailing slash, a missing scheme, or a full `get.php` URL copied out of a
 * provider's welcome email. Ported from OpenTV's `SourceRepository.normaliseUrl`.
 *
 * For Xtream we want the bare host, so API paths are stripped. For M3U the URL *is* the
 * playlist — stripping the path there would destroy it.
 */
export function normaliseUrl(raw: string, kind: SourceKind): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  if (kind === "m3u") return url;
  for (const marker of ["/player_api.php", "/panel_api.php", "/get.php", "/xmltv.php"]) {
    const at = url.indexOf(marker);
    if (at >= 0) url = url.slice(0, at);
  }
  return url.replace(/\/+$/, "");
}

/**
 * A pasted Xtream `get.php` / `player_api.php` link carries the credentials in its query
 * string. Pull them out so the user does not have to type them on a remote.
 */
export function credentialsFromUrl(raw: string): { username?: string; password?: string } {
  const query = raw.split("?")[1];
  if (!query) return {};
  const out: { username?: string; password?: string } = {};
  for (const pair of query.split("&")) {
    const [k, v] = pair.split("=");
    if (!k || v === undefined) continue;
    const value = safeDecode(v);
    if (k === "username") out.username = value;
    if (k === "password") out.password = value;
  }
  return out;
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v;
  }
}
