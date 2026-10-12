import { describe, expect, it } from "vitest";
import { credentialsFromUrl, normaliseUrl } from "../src/data/sourceUrl";
import { catchupUrl, liveStreamUrl, xmltvUrl } from "../src/data/xtream";
import type { Source } from "../src/data/models";

describe("normaliseUrl", () => {
  it("adds a scheme and strips Xtream API paths", () => {
    expect(normaliseUrl("example.com:8080/", "xtream")).toBe("http://example.com:8080");
    expect(normaliseUrl("http://example.com:8080/get.php?username=u&password=p&type=m3u_plus", "xtream")).toBe(
      "http://example.com:8080",
    );
    expect(normaliseUrl(" https://example.com/player_api.php?username=u ", "xtream")).toBe("https://example.com");
  });
  it("leaves an M3U playlist URL intact", () => {
    expect(normaliseUrl("example.com/get.php?username=u&password=p", "m3u")).toBe(
      "http://example.com/get.php?username=u&password=p",
    );
  });
  it("pulls credentials out of a pasted link", () => {
    expect(credentialsFromUrl("http://h/get.php?username=me%40x&password=p+w&type=m3u")).toEqual({
      username: "me@x",
      password: "p w",
    });
    expect(credentialsFromUrl("http://h")).toEqual({});
  });
});

describe("Xtream URLs", () => {
  const source: Source = {
    id: "s",
    name: "x",
    kind: "xtream",
    url: "http://h:8080",
    username: "u ser",
    password: "p/w",
    userAgent: "ua",
    liveFormat: "ts",
    lastSyncMillis: 0,
  };
  it("builds live, guide and catch-up URLs with encoded credentials", () => {
    expect(liveStreamUrl(source, "42")).toBe("http://h:8080/live/u%20ser/p%2Fw/42.ts");
    expect(xmltvUrl(source)).toBe("http://h:8080/xmltv.php?username=u%20ser&password=p%2Fw");
    const start = new Date(2026, 6, 27, 18, 5).getTime();
    expect(catchupUrl(source, "42", start, 30)).toBe("http://h:8080/timeshift/u%20ser/p%2Fw/30/2026-07-27:18-05/42.ts");
  });
});
