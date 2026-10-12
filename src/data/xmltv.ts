/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { Programme } from "./models";

/**
 * Streaming XMLTV parser, ported from OpenTV's `XmltvParser`.
 *
 * A week of guide data for a large provider is comfortably 150 MB of XML. A TV's browser
 * cannot hold that as one string, let alone a DOM, so text is pushed in chunks as it
 * downloads and each `<channel>` / `<programme>` element is emitted as soon as it is complete.
 * The caller filters (time window, known channels) so only what is shown is ever kept.
 */
export interface XmltvHandlers {
  onChannel?(id: string, displayName: string | undefined): void;
  onProgramme(channelId: string, programme: Programme): void;
}

export class XmltvStreamParser {
  private buffer = "";
  channels = 0;
  programmes = 0;
  skipped = 0;

  constructor(private readonly handlers: XmltvHandlers) {}

  push(text: string): void {
    this.buffer += text;
    this.drain(false);
  }

  end(): void {
    this.drain(true);
    this.buffer = "";
  }

  private drain(final: boolean): void {
    const buf = this.buffer;
    let pos = 0;
    for (;;) {
      const p = buf.indexOf("<programme", pos);
      const c = buf.indexOf("<channel", pos);
      if (p < 0 && c < 0) {
        // Keep a short tail in case a tag name is split across chunks.
        pos = Math.max(pos, buf.length - 12);
        break;
      }
      const isProgramme = p >= 0 && (c < 0 || p < c);
      const start = isProgramme ? p : c;
      const closeTag = isProgramme ? "</programme>" : "</channel>";
      const openEnd = buf.indexOf(">", start);
      if (openEnd < 0) {
        pos = start;
        break;
      }
      let end: number;
      if (buf.charAt(openEnd - 1) === "/") {
        end = openEnd + 1; // self-closing element
      } else {
        const close = buf.indexOf(closeTag, openEnd);
        if (close < 0) {
          pos = start;
          break;
        }
        end = close + closeTag.length;
      }
      const element = buf.slice(start, end);
      if (isProgramme) this.readProgramme(element);
      else this.readChannel(element);
      pos = end;
    }
    this.buffer = final ? "" : buf.slice(pos);
  }

  private readChannel(element: string): void {
    const id = attr(element, "id");
    if (!id) return;
    this.channels++;
    this.handlers.onChannel?.(id, childText(element, "display-name"));
  }

  private readProgramme(element: string): void {
    const channelId = attr(element, "channel");
    const start = parseXmltvTime(attr(element, "start"));
    const stop = parseXmltvTime(attr(element, "stop"));
    // A programme with no channel, no start, or a nonsensical span is not recoverable.
    if (!channelId || start === undefined) {
      this.skipped++;
      return;
    }
    const end = stop === undefined ? start + DEFAULT_DURATION : stop;
    if (end <= start) {
      this.skipped++;
      return;
    }
    this.programmes++;
    this.handlers.onProgramme(channelId, {
      start,
      end,
      title: childText(element, "title") || UNTITLED,
      description: childText(element, "desc"),
    });
  }
}

/**
 * Parses an XMLTV timestamp to epoch millis (UTC). Accepts `YYYYMMDDHHMMSS` and shorter
 * forms, optionally followed by a `+HHMM` / `-HHMM` offset. A missing offset means UTC —
 * guessing the device's zone instead is what silently shifts guides by hours.
 */
export function parseXmltvTime(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const m = /^(\d{8,14})\s*(.*)$/.exec(trimmed);
  if (!m) return undefined;
  const d = m[1];
  const seg = (from: number) => (d.length >= from + 2 ? parseInt(d.substr(from, 2), 10) : 0);
  const year = parseInt(d.substr(0, 4), 10);
  const month = parseInt(d.substr(4, 2), 10) - 1;
  const day = parseInt(d.substr(6, 2), 10);
  const utc = Date.UTC(year, month, day, seg(8), seg(10), seg(12));
  if (isNaN(utc)) return undefined;
  const offset = parseOffset(m[2]);
  return utc - (offset || 0) * 60000;
}

/** `+0100` / `-0530` / `+01:00` / `UTC` / `Z` / empty. Minutes east of UTC. */
function parseOffset(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^(Z|UTC|GMT)$/i.test(s)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})/.exec(s);
  if (!m) return undefined;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function attr(element: string, name: string): string | undefined {
  const openEnd = element.indexOf(">");
  const head = openEnd >= 0 ? element.slice(0, openEnd) : element;
  const m = new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')").exec(head);
  if (!m) return undefined;
  return decodeEntities(m[2] !== undefined ? m[2] : m[3]);
}

function childText(element: string, tag: string): string | undefined {
  const m = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">").exec(element);
  if (!m) return undefined;
  let text = m[1];
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  text = cdata ? cdata[1] : decodeEntities(text);
  text = text.trim();
  return text || undefined;
}

export function decodeEntities(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    const lower = code.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const n = lower.charAt(1) === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return isNaN(n) || n > 0x10ffff ? whole : String.fromCodePoint(n);
  });
}

const DEFAULT_DURATION = 30 * 60 * 1000;
const UNTITLED = "No information";
