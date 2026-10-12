/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { getText, HttpError, streamText } from "./http";
import { parseM3u } from "./m3u";
import type { Catalog, Channel, Programme, Source } from "./models";
import { loadBig, saveBig } from "./storage";
import { XmltvStreamParser } from "./xmltv";
import * as xtream from "./xtream";

/** Downloads a provider's channel list. Throws an HttpError with a user-facing message. */
export async function fetchCatalog(source: Source): Promise<Catalog> {
  if (source.kind === "xtream") {
    await xtream.authenticate(source);
    const [categories, channels] = await Promise.all([xtream.liveCategories(source), xtream.liveStreams(source)]);
    if (!channels.length) throw new HttpError("Signed in, but the provider returned no live channels.");
    return { sourceId: source.id, categories, channels };
  }
  const text = await getText(source.url, { userAgent: source.userAgent, timeoutMs: 120000 });
  if (!/#EXTM3U|#EXTINF/i.test(text.slice(0, 4096))) {
    throw new HttpError("That address did not return an M3U playlist. Check the URL.");
  }
  const result = parseM3u(text, source.id);
  if (!result.channels.length) throw new HttpError("The playlist loaded but contains no channels.");
  return {
    sourceId: source.id,
    categories: result.categories,
    channels: result.channels,
    declaredEpgUrl: result.declaredEpgUrl,
  };
}

export function loadCachedCatalog(sourceId: string): Promise<Catalog | undefined> {
  return loadBig<Catalog>("catalog:" + sourceId);
}

export function saveCatalog(catalog: Catalog): Promise<void> {
  return saveBig("catalog:" + catalog.sourceId, catalog);
}

export function deleteSourceData(sourceId: string): Promise<void> {
  return Promise.all([saveBig("catalog:" + sourceId, undefined), saveBig("guide:" + sourceId, undefined)]).then(
    () => undefined,
  );
}

// ---- Guide ------------------------------------------------------------------------------

/** Guide data for one provider: programmes per XMLTV channel id, sorted by start. */
export interface Guide {
  sourceId: string;
  fetchedMillis: number;
  programmes: Record<string, Programme[]>;
}

/** How much of the guide is kept. A TV has little memory; nobody scrolls a week ahead on one. */
export const GUIDE_PAST_MS = 3 * 3600 * 1000;
export const GUIDE_FUTURE_MS = 26 * 3600 * 1000;
/** A cached guide older than this is refreshed in the background. */
export const GUIDE_MAX_AGE_MS = 8 * 3600 * 1000;

export function guideUrlFor(source: Source, catalog: Catalog | undefined): string | undefined {
  if (source.epgUrl) return source.epgUrl;
  if (source.kind === "xtream") return xtream.xmltvUrl(source);
  return catalog && catalog.declaredEpgUrl;
}

/**
 * Streams the provider's XMLTV and keeps only programmes for channels in the catalogue that
 * fall inside the display window. Everything else is dropped as it is parsed.
 */
export async function fetchGuide(source: Source, catalog: Catalog, now = Date.now()): Promise<Guide | undefined> {
  const url = guideUrlFor(source, catalog);
  if (!url) return undefined;

  const wanted: Record<string, true> = {};
  for (const ch of catalog.channels) if (ch.epgChannelId) wanted[ch.epgChannelId] = true;

  const from = now - GUIDE_PAST_MS;
  const to = now + GUIDE_FUTURE_MS;
  const programmes: Record<string, Programme[]> = {};
  const parser = new XmltvStreamParser({
    onProgramme(channelId, p) {
      if (!wanted[channelId] || p.end <= from || p.start >= to) return;
      if (p.description && p.description.length > 400) p.description = p.description.slice(0, 397) + "…";
      (programmes[channelId] || (programmes[channelId] = [])).push(p);
    },
  });
  await streamText(url, (text) => parser.push(text), { userAgent: source.userAgent, timeoutMs: 120000 });
  parser.end();

  for (const id in programmes) programmes[id].sort((a, b) => a.start - b.start);
  return { sourceId: source.id, fetchedMillis: now, programmes };
}

export function loadCachedGuide(sourceId: string): Promise<Guide | undefined> {
  return loadBig<Guide>("guide:" + sourceId);
}

export function saveGuide(guide: Guide): Promise<void> {
  return saveBig("guide:" + guide.sourceId, guide);
}

/** Programmes for a channel, or an empty list when it has no guide. */
export function programmesFor(guides: Record<string, Guide>, channel: Channel): Programme[] {
  const guide = guides[channel.sourceId];
  if (!guide || !channel.epgChannelId) return EMPTY;
  return guide.programmes[channel.epgChannelId] || EMPTY;
}

/** The programme on air at `at`, by binary search. */
export function programmeAt(list: Programme[], at: number): Programme | undefined {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = list[mid];
    if (at < p.start) hi = mid - 1;
    else if (at >= p.end) lo = mid + 1;
    else return p;
  }
  return undefined;
}

export function nextProgramme(list: Programme[], at: number): Programme | undefined {
  for (const p of list) if (p.start >= at) return p;
  return undefined;
}

const EMPTY: Programme[] = [];
