import { describe, expect, it } from "vitest";
import type { Programme } from "../src/data/models";
import { decodeEntities, parseXmltvTime, XmltvStreamParser } from "../src/data/xmltv";

const DOC = `<?xml version="1.0"?>
<tv>
  <channel id="bbc1.uk"><display-name>BBC One</display-name></channel>
  <programme start="20260727183000 +0100" stop="20260727190000 +0100" channel="bbc1.uk">
    <title lang="en">News &amp; Weather</title>
    <desc><![CDATA[Headlines <b>now</b>]]></desc>
  </programme>
  <programme start="20260727190000 +0100" channel="bbc1.uk"><title>No stop</title></programme>
  <programme start="20260727200000 +0100" stop="20260727193000 +0100" channel="bbc1.uk"><title>Backwards</title></programme>
  <programme stop="20260727200000" channel="bbc1.uk"><title>No start</title></programme>
</tv>`;

function parseAll(chunks: string[]) {
  const programmes: Array<[string, Programme]> = [];
  const channels: Array<[string, string | undefined]> = [];
  const p = new XmltvStreamParser({
    onChannel: (id, name) => channels.push([id, name]),
    onProgramme: (id, prog) => programmes.push([id, prog]),
  });
  for (const c of chunks) p.push(c);
  p.end();
  return { programmes, channels, parser: p };
}

describe("parseXmltvTime", () => {
  it("applies the offset to give UTC", () => {
    expect(parseXmltvTime("20260727183000 +0100")).toBe(Date.UTC(2026, 6, 27, 17, 30));
    expect(parseXmltvTime("20260727183000 -0530")).toBe(Date.UTC(2026, 6, 28, 0, 0));
    expect(parseXmltvTime("20260727183000 +01:00")).toBe(Date.UTC(2026, 6, 27, 17, 30));
  });
  it("treats a missing offset as UTC and accepts short forms", () => {
    expect(parseXmltvTime("202607271830")).toBe(Date.UTC(2026, 6, 27, 18, 30));
    expect(parseXmltvTime("20260727")).toBe(Date.UTC(2026, 6, 27));
    expect(parseXmltvTime("garbage")).toBeUndefined();
    expect(parseXmltvTime(undefined)).toBeUndefined();
  });
});

describe("XmltvStreamParser", () => {
  it("parses channels and programmes, skipping unrecoverable ones", () => {
    const { programmes, channels, parser } = parseAll([DOC]);
    expect(channels).toEqual([["bbc1.uk", "BBC One"]]);
    expect(programmes.map(([, p]) => p.title)).toEqual(["News & Weather", "No stop"]);
    expect(programmes[0][1].description).toBe("Headlines <b>now</b>");
    // Missing stop defaults to 30 minutes.
    expect(programmes[1][1].end - programmes[1][1].start).toBe(30 * 60000);
    expect(parser.skipped).toBe(2);
  });

  it("gives identical results however the text is split into chunks", () => {
    const whole = parseAll([DOC]).programmes;
    for (const size of [1, 7, 13, 64]) {
      const chunks: string[] = [];
      for (let i = 0; i < DOC.length; i += size) chunks.push(DOC.slice(i, i + size));
      expect(parseAll(chunks).programmes).toEqual(whole);
    }
  });

  it("decodes entities", () => {
    expect(decodeEntities("Tom &amp; Jerry &#39;s &#x2014; &lt;x&gt;")).toBe("Tom & Jerry 's — <x>");
  });
});
