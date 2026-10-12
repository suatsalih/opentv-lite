/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useState } from "preact/hooks";
import {
  deleteSourceData,
  fetchCatalog,
  fetchGuide,
  GUIDE_MAX_AGE_MS,
  loadCachedCatalog,
  loadCachedGuide,
  saveCatalog,
  saveGuide,
  type Guide,
} from "./data/catalog";
import type { Catalog, Source } from "./data/models";
import { loadFavourites, loadSources, saveFavourites, saveSources } from "./data/settings";

/**
 * App-wide state: providers, their catalogues and guides, and favourites. A tiny observable
 * store rather than a framework — the app has one user and one screen at a time.
 */
export interface AppData {
  sources: Source[];
  catalogs: Record<string, Catalog>;
  guides: Record<string, Guide>;
  favourites: string[];
  /** Source ids currently downloading, with a user-facing error if the last attempt failed. */
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  guideLoading: boolean;
}

let data: AppData = {
  sources: loadSources(),
  catalogs: {},
  guides: {},
  favourites: loadFavourites(),
  loading: {},
  errors: {},
  guideLoading: false,
};

const listeners: Array<() => void> = [];

function set(patch: Partial<AppData>): void {
  data = { ...data, ...patch };
  for (const l of listeners.slice()) l();
}

export function getData(): AppData {
  return data;
}

export function useAppData(): AppData {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.push(l);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);
  return data;
}

/** Loads cached catalogues and guides, then refreshes anything missing or stale. */
export async function bootstrap(): Promise<void> {
  for (const source of data.sources) {
    const [catalog, guide] = await Promise.all([loadCachedCatalog(source.id), loadCachedGuide(source.id)]);
    if (catalog) set({ catalogs: { ...data.catalogs, [source.id]: catalog } });
    if (guide) set({ guides: { ...data.guides, [source.id]: guide } });
  }
  for (const source of data.sources) {
    if (!data.catalogs[source.id]) await refreshSource(source.id).catch(() => undefined);
    else if (!data.guides[source.id] || Date.now() - data.guides[source.id].fetchedMillis > GUIDE_MAX_AGE_MS)
      refreshGuide(source.id).catch(() => undefined);
  }
}

/** Downloads the channel list (and then the guide). Rejects with a user-facing message. */
export async function refreshSource(sourceId: string): Promise<void> {
  const source = data.sources.filter((s) => s.id === sourceId)[0];
  if (!source) return;
  set({ loading: { ...data.loading, [sourceId]: true }, errors: omit(data.errors, sourceId) });
  try {
    const catalog = await fetchCatalog(source);
    await saveCatalog(catalog);
    const updated = { ...source, lastSyncMillis: Date.now() };
    const sources = data.sources.map((s) => (s.id === sourceId ? updated : s));
    saveSources(sources);
    set({ sources, catalogs: { ...data.catalogs, [sourceId]: catalog } });
  } catch (e) {
    set({ errors: { ...data.errors, [sourceId]: messageOf(e) } });
    throw e;
  } finally {
    set({ loading: omit(data.loading, sourceId) });
  }
  // The guide is a bonus: a failure here never blocks watching.
  refreshGuide(sourceId).catch(() => undefined);
}

export async function refreshGuide(sourceId: string): Promise<void> {
  const source = data.sources.filter((s) => s.id === sourceId)[0];
  const catalog = data.catalogs[sourceId];
  if (!source || !catalog) return;
  set({ guideLoading: true });
  try {
    const guide = await fetchGuide(source, catalog);
    if (guide) {
      await saveGuide(guide);
      set({ guides: { ...data.guides, [sourceId]: guide } });
    }
  } finally {
    set({ guideLoading: false });
  }
}

/** Adds a provider and downloads its channels. Rejects (and adds nothing) if that fails. */
export async function addSource(source: Source): Promise<void> {
  const sources = data.sources.concat(source);
  set({ sources });
  try {
    await refreshSource(source.id);
    saveSources(data.sources);
  } catch (e) {
    set({ sources: data.sources.filter((s) => s.id !== source.id), errors: omit(data.errors, source.id) });
    throw e;
  }
}

export async function removeSource(sourceId: string): Promise<void> {
  const sources = data.sources.filter((s) => s.id !== sourceId);
  saveSources(sources);
  set({
    sources,
    catalogs: omit(data.catalogs, sourceId),
    guides: omit(data.guides, sourceId),
    favourites: data.favourites.filter((k) => k.indexOf(sourceId + ":") !== 0),
  });
  saveFavourites(data.favourites);
  await deleteSourceData(sourceId);
}

export function toggleFavourite(channelKey: string): void {
  const has = data.favourites.indexOf(channelKey) >= 0;
  const favourites = has ? data.favourites.filter((k) => k !== channelKey) : data.favourites.concat(channelKey);
  saveFavourites(favourites);
  set({ favourites });
}

export function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return "Something went wrong.";
}

function omit<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k in obj) if (k !== key) out[k] = obj[k];
  return out;
}
