/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */

export type SourceKind = "xtream" | "m3u";
export type LiveFormat = "m3u8" | "ts";

/** A provider the user has added. Credentials never leave the TV. */
export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  /** Xtream: bare base URL (`http://host:port`). M3U: the playlist URL itself. */
  url: string;
  username?: string;
  password?: string;
  /** Explicit XMLTV URL. For Xtream it is derived when empty. */
  epgUrl?: string;
  userAgent: string;
  /** Xtream live container. HLS plays everywhere; some panels only serve MPEG-TS. */
  liveFormat: LiveFormat;
  lastSyncMillis: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Channel {
  /** Unique across all sources: `${sourceId}:${streamId}`. */
  key: string;
  sourceId: string;
  streamId: string;
  name: string;
  categoryId?: string;
  logoUrl?: string;
  /** Joins to XMLTV `<channel id>`. Frequently missing; then the channel has no guide. */
  epgChannelId?: string;
  number?: number;
  streamUrl: string;
  tvArchive: boolean;
  tvArchiveDays: number;
}

export interface Programme {
  start: number; // epoch millis, UTC
  end: number;
  title: string;
  description?: string;
}

/** Everything one provider contributes, cached between launches. */
export interface Catalog {
  sourceId: string;
  categories: Category[];
  channels: Channel[];
  /** XMLTV URL the playlist header declared, if any (M3U `url-tvg`). */
  declaredEpgUrl?: string;
}
