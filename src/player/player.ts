/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { AvPlayPlayer } from "./avplay";
import { Html5Player } from "./html5";

/**
 * One video surface for the whole app. It sits underneath the UI; screens cut a transparent
 * "window" where they want the picture (the guide's preview box, or the whole screen).
 *
 * Rectangles are in the app's 1920×1080 coordinate space on every platform.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PlayerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "playing" }
  | { kind: "paused" }
  | { kind: "error"; message: string };

export interface VideoPlayer {
  play(url: string): void;
  stop(): void;
  pause(): void;
  resume(): void;
  setRect(rect: Rect): void;
  onState(listener: (state: PlayerState) => void): void;
}

export const FULL_SCREEN: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

let instance: VideoPlayer | null = null;

export function getPlayer(): VideoPlayer {
  if (!instance) instance = __PLATFORM__ === "tizen" ? new AvPlayPlayer() : new Html5Player();
  return instance;
}

/** Turns a decoder failure into something a viewer can act on. */
export function describePlaybackError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.indexOf("403") >= 0 || s.indexOf("401") >= 0)
    return "The provider refused this stream. Your subscription may have expired, or too many devices are watching.";
  if (s.indexOf("404") >= 0) return "This channel is not available from the provider right now.";
  // Checked before "network": a codec failure can arrive wrapped in a network-typed error.
  if (s.indexOf("codec") >= 0 || s.indexOf("format") >= 0 || s.indexOf("not supported") >= 0 || s.indexOf("media error 4") >= 0)
    return "This device cannot play this stream's format. Try switching the provider between HLS and MPEG-TS.";
  if (s.indexOf("network") >= 0 || s.indexOf("connection") >= 0 || s.indexOf("timeout") >= 0)
    return "The stream could not be reached. Check the TV's internet connection.";
  return "This channel could not be played. Try again, or pick another channel.";
}
