import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { languages } from "../src/i18n";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();

describe("translations", () => {
  const codes = Object.keys(languages).filter((c) => c !== "en");

  it("ships the same 30 languages as OpenTV for Android", () => {
    expect(codes.length).toBe(30);
  });

  for (const code of codes) {
    it(`${code}: every string translated, placeholders intact`, () => {
      const tr = languages[code] as Record<string, string>;
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(tr[key], `${code}.${key} missing`).toBeTruthy();
        expect(placeholders(tr[key]), `${code}.${key} placeholders`).toEqual(placeholders(en[key]));
      }
    });
  }
});
