/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { Source } from "./models";
import { loadLocal, saveLocal } from "./storage";

export function loadSources(): Source[] {
  return loadLocal<Source[]>("sources", []);
}

export function saveSources(sources: Source[]): void {
  saveLocal("sources", sources);
}

export function loadFavourites(): string[] {
  return loadLocal<string[]>("favourites", []);
}

export function saveFavourites(keys: string[]): void {
  saveLocal("favourites", keys);
}

/** The last channel watched, so the app reopens on it. */
export function loadLastChannel(): string | undefined {
  return loadLocal<string | undefined>("lastChannel", undefined);
}

export function saveLastChannel(key: string): void {
  saveLocal("lastChannel", key);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
