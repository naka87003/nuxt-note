export const NOTE_DATE_GROUPS = [
  "Today",
  "Last 7 Days",
  "This Month",
  "Last Month",
  "Older",
] as const;
export type NoteDateGroup = (typeof NOTE_DATE_GROUPS)[number];

export function getNoteDateGroup(
  updatedAt: string | Date,
  now = new Date(),
): NoteDateGroup {
  const timestamp = new Date(updatedAt).getTime();

  if (!Number.isFinite(timestamp) || !Number.isFinite(now.getTime())) {
    throw new RangeError("A valid updatedAt and reference date are required.");
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (timestamp >= today.getTime()) return "Today";
  if (timestamp >= weekAgo.getTime()) return "Last 7 Days";
  if (timestamp >= thisMonth.getTime()) return "This Month";
  if (timestamp >= lastMonth.getTime()) return "Last Month";

  return "Older";
}

export function groupNotesByUpdatedAt<
  T extends { id: string; updatedAt: string | Date },
>(notes: readonly T[], now = new Date()) {
  const grouped: Record<NoteDateGroup, T[]> = {
    Today: [],
    "Last 7 Days": [],
    "This Month": [],
    "Last Month": [],
    Older: [],
  };

  for (const note of notes) {
    grouped[getNoteDateGroup(note.updatedAt, now)].push(note);
  }

  return NOTE_DATE_GROUPS.map((label) => ({
    label,
    notes: grouped[label].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.id.localeCompare(b.id),
    ),
  })).filter((group) => group.notes.length > 0);
}
