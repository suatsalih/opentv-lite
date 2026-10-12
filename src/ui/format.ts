/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */

/** 24-hour local time, the way the guide shows it. */
export function hhmm(millis: number): string {
  const d = new Date(millis);
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return p(d.getHours()) + ":" + p(d.getMinutes());
}

export const HALF_HOUR = 30 * 60 * 1000;

export function floorToHalfHour(millis: number): number {
  return Math.floor(millis / HALF_HOUR) * HALF_HOUR;
}
