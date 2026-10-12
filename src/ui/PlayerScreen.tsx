/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useState } from "preact/hooks";
import { nextProgramme, programmeAt, programmesFor } from "../data/catalog";
import { saveLastChannel } from "../data/settings";
import { t } from "../i18n";
import { useKeys } from "../nav/keys";
import { FULL_SCREEN } from "../player/player";
import { playUrl, setVideoRect, togglePause, usePlayerState } from "../player/session";
import { toggleFavourite, useAppData } from "../state";
import type { PlayRequest } from "./App";
import { hhmm } from "./format";
import { IconStar } from "./icons";

const INFO_VISIBLE_MS = 5000;

/** Full-screen playback with the channel banner. Back returns to the guide. */
export function PlayerScreen({ request, onClose }: { request: PlayRequest; onClose(channelKey: string): void }) {
  const data = useAppData();
  const player = usePlayerState();
  const [index, setIndex] = useState(request.index);
  const [catchup, setCatchup] = useState(request.catchup);
  const [infoUntil, setInfoUntil] = useState(Date.now() + INFO_VISIBLE_MS);
  const [, tick] = useState(0);

  const channels = request.channels;
  const channel = channels[index];

  useEffect(() => {
    setVideoRect(FULL_SCREEN);
  }, []);

  useEffect(() => {
    if (!channel) return;
    if (catchup) playUrl(catchup.url);
    else {
      playUrl(channel.streamUrl);
      saveLastChannel(channel.key);
    }
    setInfoUntil(Date.now() + INFO_VISIBLE_MS);
  }, [channel && channel.key, catchup && catchup.url]);

  // Re-render when the banner should hide.
  useEffect(() => {
    const wait = infoUntil - Date.now();
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => tick((n) => n + 1), wait + 50);
    return () => clearTimeout(timer);
  }, [infoUntil]);

  function zap(delta: number) {
    if (!channels.length) return;
    setCatchup(undefined);
    setIndex((i) => (i + delta + channels.length) % channels.length);
  }

  useKeys((key) => {
    if (key === "back") onClose(channel ? channel.key : "");
    else if (key === "up" || key === "chup") zap(-1);
    else if (key === "down" || key === "chdown") zap(1);
    else if (key === "ok" || key === "info") setInfoUntil(Date.now() + INFO_VISIBLE_MS);
    else if (key === "playpause" || key === "pause" || key === "play") togglePause();
    else if (key === "yellow" && channel) toggleFavourite(channel.key);
    else return false;
  });

  if (!channel) return null;
  const now = Date.now();
  const programmes = programmesFor(data.guides, channel);
  const current = programmeAt(programmes, now);
  const next = current ? nextProgramme(programmes, current.end) : undefined;
  const showInfo = now < infoUntil || player.kind === "error" || player.kind === "paused";
  const favourite = data.favourites.indexOf(channel.key) >= 0;

  return (
    <div class="screen player">
      {player.kind === "loading" && <div class="spinner" />}
      {player.kind === "error" && <div class="player-error">{player.message}</div>}
      {showInfo && (
        <div class="banner">
          <div class="banner-top">
            {channel.number !== undefined && <span class="banner-num">{channel.number}</span>}
            {channel.logoUrl && <img class="banner-logo" src={channel.logoUrl} alt="" />}
            <span class="banner-name">{channel.name}</span>
            {favourite && (
              <span class="banner-fav">
                <IconStar size={40} />
              </span>
            )}
            {player.kind === "paused" && <span class="banner-paused">❚❚</span>}
          </div>
          {catchup ? (
            <div class="banner-prog">{catchup.title}</div>
          ) : current ? (
            <>
              <div class="banner-prog">
                <span class="info-time">
                  {hhmm(current.start)}–{hhmm(current.end)}
                </span>{" "}
                {current.title}
              </div>
              <div class="progress">
                <div
                  class="progress-fill"
                  style={{ width: Math.round(((now - current.start) / (current.end - current.start)) * 100) + "%" }}
                />
              </div>
              {next && <div class="banner-next">{t("guide_next", { time: hhmm(next.start), title: next.title })}</div>}
            </>
          ) : (
            <div class="banner-next">{t("guide_no_info")}</div>
          )}
          <div class="banner-hint">{t("player_hint")}</div>
        </div>
      )}
    </div>
  );
}
