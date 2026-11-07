import { describe, expect, it } from "vitest";
import {
  getNoteDateGroup,
  groupNotesByUpdatedAt,
} from "../../../../shared/utils/note-date-groups";

const now = new Date("2026-11-03T03:00:00Z");
const DAY = 86_400_000;
const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds);

describe("note date groups", () => {
  it.each([
    [0, "Today"],
    [DAY, "Today"],
    [DAY + 1, "Last 7 Days"],
    [7 * DAY, "Last 7 Days"],
    [7 * DAY + 1, "Last Month"],
    [30 * DAY, "Last Month"],
    [30 * DAY + 1, "Older"],
  ] as const)("assigns an age of %i ms to exactly one group", (age, label) => {
    expect(getNoteDateGroup(ago(age), now)).toBe(label);
  });

  it("uses elapsed time consistently across time zones", () => {
    expect(getNoteDateGroup("2026-11-02T12:00:00+09:00", now)).toBe("Today");
  });

  it("rejects invalid timestamps", () => {
    expect(() => getNoteDateGroup("invalid", now)).toThrow(RangeError);
  });

  it("hides empty groups, sorts newest first, and preserves the input", () => {
    const notes = [
      { id: "old", updatedAt: ago(40 * DAY) },
      { id: "earlier", updatedAt: ago(2 * DAY) },
      { id: "later", updatedAt: ago(DAY + 1) },
    ];
    expect(
      groupNotesByUpdatedAt(notes, now).map((g) => [
        g.label,
        g.notes.map((n) => n.id),
      ]),
    ).toEqual([
      ["Last 7 Days", ["later", "earlier"]],
      ["Older", ["old"]],
    ]);
    expect(notes.map((n) => n.id)).toEqual(["old", "earlier", "later"]);
  });
});
