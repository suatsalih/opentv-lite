import { describe, expect, it } from "vitest";
import { parseM3u } from "../src/data/m3u";

describe("parseM3u", () => {
  it("reads channels, groups, logos, numbers and the declared guide", () => {
    const text = [
      '#EXTM3U url-tvg="http://example.com/xmltv.php?username=u&password=p"',
      '#EXTINF:-1 tvg-id="bbc1.uk" tvg-chno="101" tvg-logo="http://img/bbc1.png" group-title="UK",BBC One',
      "http://example.com/a.m3u8",
      '#EXTINF:-1 tvg-id="itv.uk" group-title="UK",ITV',
      "#EXTVLCOPT:http-user-agent=Foo",
      "http://example.com/b.m3u8",
      '#EXTINF:-1 group-title="News",Sky News',
      "http://example.com/c.m3u8",
    ].join("\n");
    const r = parseM3u(text, "s1");
    expect(r.declaredEpgUrl).toBe("http://example.com/xmltv.php?username=u&password=p");
    expect(r.channels.map((c) => c.name)).toEqual(["BBC One", "ITV", "Sky News"]);
    expect(r.categories.map((c) => c.name)).toEqual(["UK", "News"]);
    const bbc = r.channels[0];
    expect(bbc.number).toBe(101);
    expect(bbc.logoUrl).toBe("http://img/bbc1.png");
    expect(bbc.epgChannelId).toBe("bbc1.uk");
    expect(bbc.key).toBe("s1:tvg:bbc1.uk");
    // The EXTVLCOPT between EXTINF and URL must not break the pairing.
    expect(r.channels[1].streamUrl).toBe("http://example.com/b.m3u8");
    expect(r.channels[2].streamId.indexOf("url:")).toBe(0);
  });

  it("falls back to tvg-name, survives commas in attributes, and skips orphan URLs", () => {
    const text = [
      "#EXTM3U",
      "http://example.com/orphan.m3u8",
      '#EXTINF:-1 tvg-name="Fallback Name" group-title="A, B",',
      "http://example.com/x.m3u8",
    ].join("\r\n");
    const r = parseM3u(text, "s");
    expect(r.skipped).toBe(1);
    expect(r.channels[0].name).toBe("Fallback Name");
    expect(r.channels[0].categoryId).toBe("A, B");
  });

  it("keeps the first of duplicate tvg-ids instead of failing", () => {
    const text = [
      '#EXTINF:-1 tvg-id="dup",HD',
      "http://example.com/hd.m3u8",
      '#EXTINF:-1 tvg-id="dup",SD',
      "http://example.com/sd.m3u8",
    ].join("\n");
    const r = parseM3u(text, "s");
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].name).toBe("HD");
  });
});
