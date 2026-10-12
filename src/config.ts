/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */

/**
 * The one place the project's identity is written down: name, links and the donation route.
 * Everything user-facing reads from here, so a fork changes this file and nothing else.
 */
export const APP = {
  name: "OpenTV Lite",
  version: "0.1.0",
  repo: "github.com/suatsalih/opentv-lite",
  issues: "github.com/suatsalih/opentv-lite/issues",
  /** The full Android app this is the big-screen companion of. */
  androidApp: "github.com/suatsalih/opentv",
  installPage: "suatsalih.github.io/opentv",
  licence: "https://www.gnu.org/licenses/gpl-3.0.html",
  paypalEmail: "suat.salih@gmail.com",
  paypalUrl:
    "https://www.paypal.com/donate/?business=suat.salih@gmail.com&item_name=Support+OpenTV&no_recurring=0",
  /** Sent to providers. Some panels reject unknown agents; overridable per provider. */
  defaultUserAgent: "OpenTV-Lite/0.1",
} as const;

/** Platform the bundle was built for (see `src/globals.d.ts`). */
export const BUILD_PLATFORM: "tizen" | "webos" | "browser" = __PLATFORM__;
