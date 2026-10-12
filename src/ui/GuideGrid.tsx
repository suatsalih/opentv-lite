/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { programmesFor, type Guide } from "../data/catalog";
import type { Channel, Programme } from "../data/models";
import { t } from "../i18n";
import { HALF_HOUR, hhmm } from "./format";
import { IconStar, IconStarOutline } from "./icons";

/**
 * The programme grid. Only the handful of rows on screen are rendered, whatever the size of
 * the channel list — a 20,000-channel "All channels" costs the same as a 20-channel group.
 * Geometry matches OpenTV's guide: 134 px rows and 8 px per minute.
 */
export const ROW_HEIGHT = 134;
export const PX_PER_MIN = 8;
const AREA_WIDTH = 794;
export const GUIDE_SPAN_MS = (AREA_WIDTH / PX_PER_MIN) * 60000;
const VISIBLE_ROWS = 5;

interface Props {
  channels: Channel[];
  row: number;
  /** undefined: guide not focused. null: channel cell focused. number: time cursor. */
  focusTime: number | null | undefined;
  guideFocused: boolean;
  viewStart: number;
  now: number;
  guides: Record<string, Guide>;
  favourites: string[];
}

export function GuideGrid(props: Props) {
  const { channels, row, viewStart, now } = props;
  // Keep the focused row second from the top, as OpenTV does, so there is always context above.
  const first = Math.max(0, Math.min(row - 1, channels.length - VISIBLE_ROWS));
  const visible = channels.slice(first, first + VISIBLE_ROWS + 1);

  const slots: number[] = [];
  for (let s = viewStart; s < viewStart + GUIDE_SPAN_MS; s += HALF_HOUR) slots.push(s);
  const nowX = ((now - viewStart) / 60000) * PX_PER_MIN;

  return (
    <section class="guide">
      <div class="guide-header">
        {slots.map((s) => (
          <div key={s} class="slot" style={{ left: px(((s - viewStart) / 60000) * PX_PER_MIN) }}>
            {hhmm(s)}
          </div>
        ))}
      </div>
      <div class="guide-rows">
        {visible.map((ch, i) => {
          const index = first + i;
          const isRow = index === row;
          return (
            <GuideRow
              key={ch.key}
              channel={ch}
              top={i * ROW_HEIGHT}
              programmes={programmesFor(props.guides, ch)}
              favourite={props.favourites.indexOf(ch.key) >= 0}
              channelFocused={isRow && props.focusTime === null}
              rowFocused={isRow && props.guideFocused}
              focusTime={isRow && typeof props.focusTime === "number" ? props.focusTime : undefined}
              viewStart={viewStart}
              now={now}
            />
          );
        })}
        {nowX > 0 && nowX < AREA_WIDTH && <div class="now-line" style={{ left: px(446 + nowX) }} />}
      </div>
    </section>
  );
}

interface RowProps {
  channel: Channel;
  top: number;
  programmes: Programme[];
  favourite: boolean;
  channelFocused: boolean;
  rowFocused: boolean;
  focusTime: number | undefined;
  viewStart: number;
  now: number;
}

function GuideRow(p: RowProps) {
  const ch = p.channel;
  const end = p.viewStart + GUIDE_SPAN_MS;
  const cells: Programme[] = [];
  for (const prog of p.programmes) {
    if (prog.end <= p.viewStart) continue;
    if (prog.start >= end) break;
    cells.push(prog);
  }
  return (
    <div class="guide-row" style={{ top: px(p.top) }}>
      <div class={"chan" + (p.channelFocused ? " focused" : p.rowFocused ? " row-focused" : "")}>
        <div class="chan-num">{ch.number !== undefined ? ch.number : ""}</div>
        <div class="chan-logo">{ch.logoUrl ? <img src={ch.logoUrl} alt="" /> : <span>{initials(ch.name)}</span>}</div>
        <div class="chan-name">{ch.name}</div>
        <div class={"chan-star" + (p.favourite ? " on" : "")}>
          {p.favourite ? <IconStar size={44} /> : <IconStarOutline size={44} />}
        </div>
      </div>
      <div class="progs">
        {cells.length === 0 && (
          <div
            class={"prog empty" + (p.focusTime !== undefined ? " focused" : "")}
            style={{ left: "0", width: px((GUIDE_SPAN_MS / 60000) * PX_PER_MIN - 8) }}
          >
            {t("guide_no_info")}
          </div>
        )}
        {cells.map((prog) => {
          const left = Math.max(0, ((prog.start - p.viewStart) / 60000) * PX_PER_MIN);
          const right = Math.min(((end - p.viewStart) / 60000) * PX_PER_MIN, ((prog.end - p.viewStart) / 60000) * PX_PER_MIN);
          const width = Math.max(4, right - left - 8);
          const live = prog.start <= p.now && p.now < prog.end;
          const focused = p.focusTime !== undefined && prog.start <= p.focusTime && p.focusTime < prog.end;
          const progress = live ? (p.now - prog.start) / (prog.end - prog.start) : 0;
          return (
            <div
              key={prog.start}
              class={"prog" + (live ? " live" : "") + (prog.end <= p.now ? " past" : "") + (focused ? " focused" : "")}
              style={{ left: px(left), width: px(width) }}
            >
              <span class="prog-title">{prog.title}</span>
              {live && <div class="prog-progress" style={{ width: Math.round(progress * 100) + "%" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Preact 11 no longer appends "px" to numeric style values, so lengths are written out. */
function px(n: number): string {
  return Math.round(n) + "px";
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(" ").filter(Boolean);
  return (words[0] ? words[0].charAt(0) : "") + (words[1] ? words[1].charAt(0) : "");
}
