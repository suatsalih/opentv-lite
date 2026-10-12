/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useState } from "preact/hooks";
import { describePlaybackError, getPlayer, type PlayerState, type Rect } from "./player";

/**
 * What is playing right now, shared by the guide preview and the full-screen player so that
 * going full screen on the channel already previewing does not re-tune it.
 */
let currentUrl: string | null = null;
let state: PlayerState = { kind: "idle" };
const listeners: Array<(s: PlayerState) => void> = [];
let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;
  getPlayer().onState((s) => {
    state = s.kind === "error" ? { kind: "error", message: describePlaybackError(s.message) } : s;
    for (const l of listeners.slice()) l(state);
  });
}

export function playUrl(url: string): void {
  wire();
  if (url === currentUrl && state.kind !== "error" && state.kind !== "idle") return;
  currentUrl = url;
  getPlayer().play(url);
}

export function stopPlayback(): void {
  wire();
  currentUrl = null;
  getPlayer().stop();
}

export function currentPlayingUrl(): string | null {
  return currentUrl;
}

export function setVideoRect(rect: Rect): void {
  wire();
  getPlayer().setRect(rect);
}

export function togglePause(): void {
  wire();
  if (state.kind === "paused") getPlayer().resume();
  else getPlayer().pause();
}

export function usePlayerState(): PlayerState {
  wire();
  const [s, setS] = useState<PlayerState>(state);
  useEffect(() => {
    listeners.push(setS);
    return () => {
      const i = listeners.indexOf(setS);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);
  return s;
}
