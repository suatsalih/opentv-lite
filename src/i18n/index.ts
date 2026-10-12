/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { en, type Strings } from "./en";

/**
 * Translations. English is the reference; other languages are added as files beside `en.ts`
 * (OpenTV's Android translations are the source for them) and picked from the TV's language.
 * A missing key in a translation falls back to English rather than showing a raw key.
 */
const languages: Record<string, Partial<Strings>> = { en };

let active: Partial<Strings> = en;

export function initLanguage(): void {
  const tag = (navigator.language || "en").toLowerCase();
  active = languages[tag] || languages[tag.split("-")[0]] || en;
}

export function t(key: keyof Strings, params?: Record<string, string | number>): string {
  let s = (active[key] as string | undefined) || en[key];
  if (params) for (const k in params) s = s.split("{" + k + "}").join(String(params[k]));
  return s;
}
