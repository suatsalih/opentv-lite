/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { getJson, HttpError } from "./http";
import type { Category, Channel, Source } from "./models";

/**
 * Xtream Codes `player_api.php` client, ported from OpenTV's `XtreamApi`.
 *
 * Panels disagree about types constantly (numbers as strings, `null` as the string "null",
 * arrays where objects were expected), so every accessor here is defensive and returns
 * undefined rather than throwing. One odd field must never cost the user a channel list.
 */
export interface AccountInfo {
  username?: string;
  expiryMillis?: number;
  maxConnections?: number;
  activeConnections?: number;
}

type Json = Record<string, unknown>;

export async function authenticate(source: Source): Promise<AccountInfo> {
  const body = await api<Json>(source);
  const user = asObject(body && body["user_info"]);
  if (!user) throw new HttpError("The server did not return account information.");
  const status = str(user["status"]);
  if (status && status.toLowerCase() !== "active") throw new HttpError(`This account is ${status}.`);
  if (int(user["auth"]) === 0) throw new HttpError("Username or password rejected by the server.");
  const exp = int(user["exp_date"]);
  return {
    username: str(user["username"]),
    expiryMillis: exp ? exp * 1000 : undefined,
    maxConnections: int(user["max_connections"]),
    activeConnections: int(user["active_cons"]),
  };
}

export async function liveCategories(source: Source): Promise<Category[]> {
  const list = asArray(await api(source, "get_live_categories"));
  const out: Category[] = [];
  for (const el of list) {
    const obj = asObject(el);
    const id = obj && str(obj["category_id"]);
    if (!obj || !id) continue;
    out.push({ id, name: str(obj["category_name"]) || id });
  }
  return out;
}

export async function liveStreams(source: Source): Promise<Channel[]> {
  const list = asArray(await api(source, "get_live_streams"));
  const out: Channel[] = [];
  for (const el of list) {
    const obj = asObject(el);
    if (!obj) continue;
    const streamId = str(obj["stream_id"]);
    const name = str(obj["name"]);
    if (!streamId || !name) continue;
    out.push({
      key: source.id + ":" + streamId,
      sourceId: source.id,
      streamId,
      name,
      categoryId: str(obj["category_id"]),
      logoUrl: str(obj["stream_icon"]),
      // epg_channel_id joins to XMLTV; when blank the channel simply has no guide.
      epgChannelId: str(obj["epg_channel_id"]),
      number: int(obj["num"]),
      streamUrl: liveStreamUrl(source, streamId),
      tvArchive: int(obj["tv_archive"]) === 1,
      tvArchiveDays: int(obj["tv_archive_duration"]) || 0,
    });
  }
  return out;
}

export function liveStreamUrl(source: Source, streamId: string): string {
  return `${source.url}/live/${enc(source.username)}/${enc(source.password)}/${streamId}.${source.liveFormat}`;
}

export function xmltvUrl(source: Source): string {
  return `${source.url}/xmltv.php?username=${enc(source.username)}&password=${enc(source.password)}`;
}

/**
 * Catch-up stream for a past programme, using the widely supported
 * `/timeshift/{user}/{pass}/{minutes}/{yyyy-MM-dd:HH-mm}/{streamId}.ts` form. The start is
 * formatted in the TV's local zone, matching how the guide shows times.
 */
export function catchupUrl(source: Source, streamId: string, startMillis: number, minutes: number): string {
  const d = new Date(startMillis);
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}:${p(d.getHours())}-${p(d.getMinutes())}`;
  return `${source.url}/timeshift/${enc(source.username)}/${enc(source.password)}/${Math.max(1, minutes)}/${stamp}/${streamId}.ts`;
}

function api<T = unknown>(source: Source, action?: string): Promise<T> {
  let url = `${source.url}/player_api.php?username=${enc(source.username)}&password=${enc(source.password)}`;
  if (action) url += "&action=" + action;
  return getJson<T>(url, { userAgent: source.userAgent, timeoutMs: 60000 });
}

function enc(v: string | undefined): string {
  return encodeURIComponent(v || "");
}

// ---- Defensive JSON accessors -------------------------------------------------------------

function asObject(v: unknown): Json | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  // Some panels return an object keyed by index instead of an array.
  const obj = asObject(v);
  return obj ? Object.keys(obj).map((k) => obj[k]) : [];
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim();
  return s && s !== "null" ? s : undefined;
}

function int(v: unknown): number | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}
