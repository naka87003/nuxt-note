import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNoteDateGroup,
  groupNotesByUpdatedAt,
} from "#shared/utils/note-date-groups";

// Dates without an offset intentionally use the viewer's local calendar.
const now = new Date("2026-11-16T12:00:00");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("note date groups", () => {
  it.each([
    ["2026-11-16T00:00:00", "Today"],
    ["2026-11-16T11:00:00", "Today"],
    ["2026-11-15T23:59:59.999", "Last 7 Days"],
    ["2026-11-09T00:00:00", "Last 7 Days"],
    ["2026-11-08T23:59:59.999", "This Month"],
    ["2026-11-01T00:00:00", "This Month"],
    ["2026-10-31T23:59:59.999", "Last Month"],
    ["2026-10-01T00:00:00", "Last Month"],
    ["2026-09-30T23:59:59.999", "Older"],
  ] as const)(
    "assigns %s to %s using calendar boundaries",
    (updatedAt, label) => {
      expect(getNoteDateGroup(updatedAt, now)).toBe(label);
    },
  );

  it("keeps recent notes in Last 7 Days across a month boundary", () => {
    expect(
      getNoteDateGroup("2026-10-31T23:59:59", new Date("2026-11-03T12:00:00")),
    ).toBe("Last 7 Days");
  });

  it.each([
    ["2027-01-16T12:00:00", "2026-12-01T00:00:00", "Last Month"],
    ["2027-01-16T12:00:00", "2026-11-30T23:59:59", "Older"],
    ["2028-03-16T12:00:00", "2028-02-29T12:00:00", "Last Month"],
    ["2028-03-16T12:00:00", "2028-01-31T23:59:59", "Older"],
  ] as const)(
    "handles year and leap-month boundaries (%s, %s)",
    (reference, updatedAt, label) => {
      expect(getNoteDateGroup(updatedAt, new Date(reference))).toBe(label);
    },
  );

  it.each([
    ["Asia/Tokyo", "Today"],
    ["UTC", "Last 7 Days"],
  ] as const)("uses the viewer's %s calendar", (timezone, label) => {
    vi.stubEnv("TZ", timezone);
    expect(
      getNoteDateGroup(
        "2026-11-15T23:00:00Z",
        new Date("2026-11-16T03:00:00Z"),
      ),
    ).toBe(label);
  });

  it.each([
    ["2026-03-09T12:00:00", "2026-03-02T00:00:00"],
    ["2026-11-02T12:00:00", "2026-10-26T00:00:00"],
  ])(
    "uses calendar days across daylight saving changes (%s)",
    (reference, updatedAt) => {
      vi.stubEnv("TZ", "America/New_York");
      expect(getNoteDateGroup(updatedAt, new Date(reference))).toBe(
        "Last 7 Days",
      );
    },
  );

  it("rejects invalid timestamps and reference dates", () => {
    expect(() => getNoteDateGroup("invalid", now)).toThrow(RangeError);
    expect(() => getNoteDateGroup(now, new Date("invalid"))).toThrow(
      RangeError,
    );
  });

  it("hides empty groups, sorts newest first, breaks ties by ID, and preserves the input", () => {
    const notes = [
      { id: "old", updatedAt: "2026-09-01T00:00:00" },
      { id: "earlier", updatedAt: "2026-11-14T00:00:00" },
      { id: "later-b", updatedAt: "2026-11-15T00:00:00" },
      { id: "later-a", updatedAt: "2026-11-15T00:00:00" },
      { id: "this-month", updatedAt: "2026-11-08T00:00:00" },
      { id: "last-month", updatedAt: "2026-10-01T00:00:00" },
    ];

    const original = [...notes];

    expect(
      groupNotesByUpdatedAt(notes, now).map((group) => [
        group.label,
        group.notes.map((note) => note.id),
      ]),
    ).toEqual([
      ["Last 7 Days", ["later-a", "later-b", "earlier"]],
      ["This Month", ["this-month"]],
      ["Last Month", ["last-month"]],
      ["Older", ["old"]],
    ]);
    expect(notes).toEqual(original);
  });
});
