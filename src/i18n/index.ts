/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { en, type Strings } from "./en";
import { ar } from "./ar";
import { bg } from "./bg";
import { cs } from "./cs";
import { da } from "./da";
import { de } from "./de";
import { el } from "./el";
import { es } from "./es";
import { fa } from "./fa";
import { fi } from "./fi";
import { fr } from "./fr";
import { hi } from "./hi";
import { hr } from "./hr";
import { hu } from "./hu";
import { id } from "./id";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { nb } from "./nb";
import { nl } from "./nl";
import { pl } from "./pl";
import { pt } from "./pt";
import { ro } from "./ro";
import { ru } from "./ru";
import { sk } from "./sk";
import { sv } from "./sv";
import { th } from "./th";
import { tr } from "./tr";
import { uk } from "./uk";
import { vi } from "./vi";
import { zh } from "./zh";

/**
 * Translations: English plus the same 30 languages as OpenTV for Android, picked from the TV's
 * language. Most strings reuse OpenTV's own translations word for word, so both apps say the
 * same thing the same way. A key missing from a translation falls back to English.
 */
export const languages: Record<string, Partial<Strings>> = { en, ar, bg, cs, da, de, el, es, fa, fi, fr, hi, hr, hu, id, it, ja, ko, nb, nl, pl, pt, ro, ru, sk, sv, th, tr, uk, vi, zh };

/** Language codes some TVs report that map onto one we ship. */
const ALIASES: Record<string, string> = { no: "nb", nn: "nb", in: "id" };

let active: Partial<Strings> = en;

export function initLanguage(): void {
  const tag = (navigator.language || "en").toLowerCase();
  const base = tag.split("-")[0];
  const code = languages[tag] ? tag : languages[base] ? base : ALIASES[base] && languages[ALIASES[base]] ? ALIASES[base] : "en";
  active = languages[code];
  document.documentElement.lang = code;
}

export function t(key: keyof Strings, params?: Record<string, string | number>): string {
  let s = (active[key] as string | undefined) || en[key];
  if (params) for (const k in params) s = s.split("{" + k + "}").join(String(params[k]));
  return s;
}
