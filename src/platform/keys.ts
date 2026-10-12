/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */

/**
 * Remote buttons, normalised. Samsung, LG and a desktop keyboard each report different key
 * codes for the same button; everything above this file only ever sees these names.
 */
export type Key =
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "play"
  | "pause"
  | "playpause"
  | "stop"
  | "chup"
  | "chdown"
  | "info"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

const CODES: Record<number, Key> = {
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  13: "ok",
  // Back: Samsung 10009, LG 461, keyboard Escape / Backspace.
  10009: "back",
  461: "back",
  27: "back",
  8: "back",
  // Tizen on-screen keyboard: Done / Cancel.
  65376: "ok",
  65385: "back",
  // Media keys (shared by Tizen and webOS unless noted).
  415: "play",
  19: "pause",
  10252: "playpause", // Tizen
  413: "stop",
  // Channel up/down: Tizen 427/428, webOS PageUp/PageDown.
  427: "chup",
  428: "chdown",
  33: "chup",
  34: "chdown",
  457: "info", // webOS / Tizen Info
  // Colour keys: Tizen 403–406, webOS 403–406 too.
  403: "red",
  404: "green",
  405: "yellow",
  406: "blue",
};

for (let i = 0; i <= 9; i++) CODES[48 + i] = String(i) as Key;

export function keyFromEvent(e: KeyboardEvent): Key | undefined {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    // While typing, only keys that leave the field are the app's; everything else is text.
    return INPUT_KEYS[e.keyCode] ? CODES[e.keyCode] : undefined;
  }
  // Desktop testing conveniences, so the browser build can exercise every remote button.
  const desktop = DESKTOP_KEYS[e.key];
  if (desktop) return desktop;
  return CODES[e.keyCode];
}

const INPUT_KEYS: Record<number, true> = { 38: true, 40: true, 13: true, 27: true, 10009: true, 461: true, 65376: true, 65385: true };

const DESKTOP_KEYS: Record<string, Key> = {
  i: "info",
  r: "red",
  g: "green",
  y: "yellow",
  b: "blue",
  "+": "chup",
  "=": "chup",
  "-": "chdown",
  " ": "playpause",
};

/** Keys a Tizen app must ask for explicitly before it receives them. */
export const TIZEN_EXTRA_KEYS = [
  "MediaPlay",
  "MediaPause",
  "MediaPlayPause",
  "MediaStop",
  "ChannelUp",
  "ChannelDown",
  "Info",
  "ColorF0Red",
  "ColorF1Green",
  "ColorF2Yellow",
  "ColorF3Blue",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];
