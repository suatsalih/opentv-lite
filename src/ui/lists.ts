/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { Catalog, Channel } from "../data/models";
import { t } from "../i18n";

/** One entry in the category column: Favourites, All channels, then the providers' groups. */
export interface CategoryEntry {
  key: string;
  name: string;
  channels: Channel[];
}

export function buildCategories(
  sourceOrder: string[],
  catalogs: Record<string, Catalog>,
  favourites: string[],
): CategoryEntry[] {
  const all: Channel[] = [];
  const byKey: Record<string, Channel> = {};
  const groups: CategoryEntry[] = [];
  const multiple = sourceOrder.filter((id) => catalogs[id]).length > 1;

  for (const sourceId of sourceOrder) {
    const catalog = catalogs[sourceId];
    if (!catalog) continue;
    const bucket: Record<string, Channel[]> = {};
    const other: Channel[] = [];
    for (const ch of catalog.channels) {
      all.push(ch);
      byKey[ch.key] = ch;
      if (ch.categoryId) (bucket[ch.categoryId] || (bucket[ch.categoryId] = [])).push(ch);
      else other.push(ch);
    }
    for (const cat of catalog.categories) {
      const channels = bucket[cat.id];
      if (!channels || !channels.length) continue; // empty groups only waste a remote press
      groups.push({ key: sourceId + "|" + cat.id, name: cat.name, channels });
    }
    if (other.length && (catalog.categories.length || multiple)) {
      groups.push({ key: sourceId + "|", name: t("cat_uncategorised"), channels: other });
    }
  }

  const favs: Channel[] = [];
  for (const k of favourites) if (byKey[k]) favs.push(byKey[k]);

  return [
    { key: "fav", name: t("cat_favourites"), channels: favs },
    { key: "all", name: t("cat_all"), channels: all },
  ].concat(groups);
}
