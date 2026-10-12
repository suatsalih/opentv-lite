/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { GUIDE_PAST_MS, nextProgramme, programmeAt, programmesFor } from "../data/catalog";
import type { Channel, Programme } from "../data/models";
import { loadLastChannel, saveLastChannel } from "../data/settings";
import * as xtream from "../data/xtream";
import { t } from "../i18n";
import { clampIndex, useKeys } from "../nav/keys";
import { exitApp } from "../platform";
import { playUrl, setVideoRect, usePlayerState } from "../player/session";
import { toggleFavourite, useAppData } from "../state";
import type { PlayRequest, Screen } from "./App";
import { floorToHalfHour, HALF_HOUR, hhmm } from "./format";
import { GuideGrid, GUIDE_SPAN_MS } from "./GuideGrid";
import { IconPlay, Logo } from "./icons";
import { buildCategories } from "./lists";
import { Rail, RAIL_ITEMS } from "./Rail";

type Zone = "rail" | "cats" | "guide";

/** Where the preview picture sits, in the 1920×1080 stage. Mirrored in styles.css (.preview). */
export const PREVIEW_RECT = { x: 662, y: 26, w: 670, h: 370 };
const PREVIEW_DELAY_MS = 700;
const CATS_VISIBLE = 11;

export function LiveTv(props: {
  active: boolean;
  onNavigate(screen: Screen): void;
  onPlay(request: PlayRequest): void;
  returnTo: { key: string } | null;
}) {
  const data = useAppData();
  const sourceOrder = data.sources.map((s) => s.id);
  const categories = useMemo(
    () => buildCategories(sourceOrder, data.catalogs, data.favourites),
    [data.catalogs, data.favourites, sourceOrder.join(",")],
  );

  const [zone, setZone] = useState<Zone>("guide");
  const [railIndex, setRailIndex] = useState(0);
  const [catIndex, setCatIndex] = useState(() => (data.favourites.length ? 0 : 1));
  const [catFocus, setCatFocus] = useState(catIndex);
  const [row, setRow] = useState(0);
  /** null = the channel cell is focused; otherwise the time cursor in the programme area. */
  const [focusTime, setFocusTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [viewStart, setViewStart] = useState(floorToHalfHour(Date.now()));
  const [toast, setToast] = useState<string | null>(null);
  const backArmed = useRef(0);
  const restoredLast = useRef(false);

  const category = categories[clampIndex(catIndex, categories.length)];
  const channels = category ? category.channels : [];
  const channel: Channel | undefined = channels[clampIndex(row, channels.length)];

  // Clock: the guide's "now" line and progress bars move once a minute is plenty, but the
  // first tick is aligned to the minute so times flip when they should.
  useEffect(() => {
    let timer = setTimeout(function tick() {
      setNow(Date.now());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    }, 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, []);

  // Reopen on the last channel watched, once the catalogue has loaded.
  useEffect(() => {
    if (restoredLast.current || !channels.length) return;
    restoredLast.current = true;
    const last = loadLastChannel();
    if (!last) return;
    const i = channels.map((c) => c.key).indexOf(last);
    if (i >= 0) setRow(i);
  }, [channels.length]);

  // Coming back from full screen: land on the channel that was being watched.
  useEffect(() => {
    if (!props.returnTo) return;
    const i = channels.map((c) => c.key).indexOf(props.returnTo.key);
    if (i >= 0) setRow(i);
    setFocusTime(null);
  }, [props.returnTo]);

  // Preview the highlighted channel after a short pause, so scrolling does not tune every row.
  useEffect(() => {
    if (!props.active || !channel) return undefined;
    setVideoRect(PREVIEW_RECT);
    const timer = setTimeout(() => playUrl(channel.streamUrl), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [channel && channel.key, props.active]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const programmes = channel ? programmesFor(data.guides, channel) : [];
  const onAir = programmeAt(programmes, now);
  const focused = focusTime === null ? onAir : programmeAt(programmes, focusTime);
  const shown = focused || onAir;
  const next = shown ? nextProgramme(programmes, shown.end) : undefined;

  function selectRow(i: number) {
    setRow(clampIndex(i, channels.length));
  }

  function ensureVisible(time: number) {
    if (time < viewStart) setViewStart(floorToHalfHour(time));
    else if (time >= viewStart + GUIDE_SPAN_MS - HALF_HOUR) setViewStart(floorToHalfHour(time) - HALF_HOUR);
  }

  function moveTime(direction: 1 | -1) {
    if (!channel) return;
    const list = programmesFor(data.guides, channel);
    const cursor = focusTime === null ? now : focusTime;
    const current = programmeAt(list, cursor);
    const earliest = channel.tvArchive ? now - GUIDE_PAST_MS : now;
    if (direction > 0) {
      const target = current ? current.end : floorToHalfHour(cursor) + HALF_HOUR;
      if (target > now + 24 * 3600 * 1000) return;
      setFocusTime(target);
      ensureVisible(target);
    } else {
      const target = current ? current.start - 1 : floorToHalfHour(cursor) - 1;
      if (target < earliest || (current && current.start <= earliest)) {
        setFocusTime(null); // back to the channel cell
        setViewStart(floorToHalfHour(now));
        return;
      }
      const prev = programmeAt(list, target);
      const time = prev ? Math.max(prev.start, earliest) : target;
      setFocusTime(time);
      ensureVisible(time);
    }
  }

  function watch(target: Channel, programme: Programme | undefined) {
    if (programme && programme.end <= now && target.tvArchive) {
      const source = data.sources.filter((s) => s.id === target.sourceId)[0];
      if (source && source.kind === "xtream") {
        const minutes = Math.round((programme.end - programme.start) / 60000);
        props.onPlay({
          channels,
          index: row,
          catchup: { url: xtream.catchupUrl(source, target.streamId, programme.start, minutes), title: programme.title },
        });
        return;
      }
    }
    if (programme && programme.start > now) {
      setToast(t("guide_next", { time: hhmm(programme.start), title: programme.title }));
      return;
    }
    saveLastChannel(target.key);
    props.onPlay({ channels, index: row });
  }

  useKeys((key) => {
    if (zone === "rail") {
      if (key === "up") setRailIndex((i) => clampIndex(i - 1, RAIL_ITEMS.length));
      else if (key === "down") setRailIndex((i) => clampIndex(i + 1, RAIL_ITEMS.length));
      else if (key === "right" || key === "back") setZone("cats");
      else if (key === "ok") {
        const target = RAIL_ITEMS[railIndex].id;
        if (target === "live") setZone("cats");
        else props.onNavigate(target);
      }
      return;
    }
    if (zone === "cats") {
      if (key === "up") setCatFocus((i) => clampIndex(i - 1, categories.length));
      else if (key === "down") setCatFocus((i) => clampIndex(i + 1, categories.length));
      else if (key === "left") {
        setRailIndex(0);
        setZone("rail");
      } else if (key === "right" || key === "ok") {
        if (catFocus !== catIndex) {
          setCatIndex(catFocus);
          setRow(0);
          setFocusTime(null);
        }
        if (categories[catFocus] && categories[catFocus].channels.length) setZone("guide");
      } else if (key === "back") {
        if (Date.now() - backArmed.current < 2500) exitApp();
        else {
          backArmed.current = Date.now();
          setToast(t("exit_confirm"));
        }
      }
      return;
    }
    // Guide
    if (key === "up") selectRow(row - 1);
    else if (key === "down") selectRow(row + 1);
    else if (key === "chup") selectRow(row - 5);
    else if (key === "chdown") selectRow(row + 5);
    else if (key === "right") moveTime(1);
    else if (key === "left") {
      if (focusTime === null) {
        setCatFocus(catIndex);
        setZone("cats");
      } else moveTime(-1);
    } else if (key === "ok" && channel) watch(channel, focusTime === null ? undefined : focused);
    else if (key === "yellow" && channel) toggleFavourite(channel.key);
    else if (key === "back") {
      if (focusTime !== null) {
        setFocusTime(null);
        setViewStart(floorToHalfHour(now));
      } else {
        setCatFocus(catIndex);
        setZone("cats");
      }
    } else return false;
  }, props.active);

  const loadingAny = Object.keys(data.loading).length > 0;
  const catTop = Math.max(0, Math.min(catFocus - Math.floor(CATS_VISIBLE / 2), categories.length - CATS_VISIBLE));

  return (
    <div class="screen live">
      <div class="preview hole" />
      <Rail current="live" focusIndex={zone === "rail" ? railIndex : null} />

      <section class="cats">
        <h1 class="screen-title">{t("nav_live")}</h1>
        <div class="cat-list">
          {categories.slice(catTop, catTop + CATS_VISIBLE).map((c, i) => {
            const index = catTop + i;
            const cls =
              "cat" +
              (zone === "cats" && index === catFocus ? " focused" : "") +
              (index === catIndex ? " current" : "");
            return (
              <div key={c.key} class={cls}>
                {c.name}
              </div>
            );
          })}
        </div>
      </section>

      <PreviewInfo channel={channel} programme={shown} next={next} now={now} />

      {channels.length ? (
        <GuideGrid
          channels={channels}
          row={row}
          focusTime={zone === "guide" ? focusTime : undefined}
          guideFocused={zone === "guide"}
          viewStart={viewStart}
          now={now}
          guides={data.guides}
          favourites={data.favourites}
        />
      ) : (
        <div class="guide-empty">
          {loadingAny
            ? t("guide_loading")
            : category && category.key === "fav"
              ? t("guide_empty_favourites")
              : t("guide_empty")}
        </div>
      )}

      {data.guideLoading && <div class="badge">{t("guide_refreshing")}</div>}
      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}

function PreviewInfo(props: { channel?: Channel; programme?: Programme; next?: Programme; now: number }) {
  const player = usePlayerState();
  const { channel, programme, next, now } = props;
  const progress =
    programme && programme.start <= now && now < programme.end
      ? (now - programme.start) / (programme.end - programme.start)
      : 0;
  return (
    <>
      <div class="preview-frame">
        {!channel && (
          <div class="preview-placeholder">
            <Logo size={140} />
          </div>
        )}
        {channel && player.kind === "error" && <div class="preview-error">{player.message}</div>}
        {channel && player.kind === "loading" && <div class="preview-loading">{t("player_loading")}</div>}
        {channel && (
          <div class="preview-watch">
            <IconPlay size={30} /> {t("guide_watch")}
          </div>
        )}
      </div>
      <section class="info">
        <div class="info-channel">{channel ? channel.name : ""}</div>
        {programme ? (
          <>
            <div class="info-now">
              <span class="info-time">
                {hhmm(programme.start)}–{hhmm(programme.end)}
              </span>
              <span class="info-title">{programme.title}</span>
            </div>
            <div class="progress">
              <div class="progress-fill" style={{ width: Math.round(progress * 100) + "%" }} />
            </div>
            {programme.description && <div class="info-desc">{programme.description}</div>}
            {next && <div class="info-next">{t("guide_next", { time: hhmm(next.start), title: next.title })}</div>}
          </>
        ) : (
          channel && <div class="info-desc">{t("guide_no_info")}</div>
        )}
      </section>
    </>
  );
}
