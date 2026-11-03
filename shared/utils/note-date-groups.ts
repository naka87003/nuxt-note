export const NOTE_DATE_GROUPS = [
  "Today",
  "Last 7 Days",
  "Last Month",
  "Older",
] as const;
export type NoteDateGroup = (typeof NOTE_DATE_GROUPS)[number];
const DAY = 24 * 60 * 60 * 1000;

export function getNoteDateGroup(
  updatedAt: string | Date,
  now = new Date(),
): NoteDateGroup {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(now.getTime())) {
    throw new RangeError("A valid updatedAt and reference date are required.");
  }
  const age = now.getTime() - timestamp;
  if (age <= DAY) return "Today";
  if (age <= 7 * DAY) return "Last 7 Days";
  if (age <= 30 * DAY) return "Last Month";
  return "Older";
}

export function groupNotesByUpdatedAt<
  T extends { id: string; updatedAt: string | Date },
>(notes: readonly T[], now = new Date()) {
  const grouped = new Map<NoteDateGroup, T[]>(
    NOTE_DATE_GROUPS.map((label) => [label, []]),
  );
  for (const note of notes)
    grouped.get(getNoteDateGroup(note.updatedAt, now))!.push(note);
  return NOTE_DATE_GROUPS.map((label) => ({
    label,
    notes: grouped
      .get(label)!
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
          a.id.localeCompare(b.id),
      ),
  })).filter((group) => group.notes.length > 0);
}
