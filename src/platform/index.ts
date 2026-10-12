/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { BUILD_PLATFORM } from "../config";
import { TIZEN_EXTRA_KEYS } from "./keys";

/**
 * Everything that differs between Samsung, LG and a desktop browser lives behind this file and
 * the player in `src/player`. Adding another web-based TV platform (VIDAA, Titan OS, Xbox)
 * means adding a case here and a player adapter, not touching the screens.
 */
declare const tizen: any;
declare const webOS: any;

export const platform = BUILD_PLATFORM;

export function initPlatform(): void {
  if (platform === "tizen" && typeof tizen !== "undefined") {
    try {
      tizen.tvinputdevice.registerKeyBatch(TIZEN_EXTRA_KEYS);
    } catch {
      // Older firmware lacks registerKeyBatch; register one by one and ignore the stragglers.
      for (const k of TIZEN_EXTRA_KEYS) {
        try {
          tizen.tvinputdevice.registerKey(k);
        } catch {
          /* key not supported on this model */
        }
      }
    }
  }
}

/** Leaves the app, the way the platform expects Back on the home screen to behave. */
export function exitApp(): void {
  try {
    if (platform === "tizen" && typeof tizen !== "undefined") {
      tizen.application.getCurrentApplication().exit();
      return;
    }
    if (platform === "webos" && typeof webOS !== "undefined" && webOS.platformBack) {
      webOS.platformBack();
      return;
    }
  } catch {
    /* fall through */
  }
  window.close();
}
