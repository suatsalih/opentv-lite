import { describe, expect, it } from "vitest";
import { nextProgramme, programmeAt } from "../src/data/catalog";
import type { Programme } from "../src/data/models";

const list: Programme[] = [
  { start: 0, end: 10, title: "a" },
  { start: 10, end: 20, title: "b" },
  { start: 30, end: 40, title: "c" },
];

describe("programmeAt / nextProgramme", () => {
  it("finds the programme on air, including at boundaries", () => {
    expect(programmeAt(list, 0)!.title).toBe("a");
    expect(programmeAt(list, 10)!.title).toBe("b");
    expect(programmeAt(list, 39)!.title).toBe("c");
    expect(programmeAt(list, 25)).toBeUndefined();
    expect(programmeAt(list, 40)).toBeUndefined();
  });
  it("finds what is next", () => {
    expect(nextProgramme(list, 20)!.title).toBe("c");
    expect(nextProgramme(list, 41)).toBeUndefined();
  });
});
