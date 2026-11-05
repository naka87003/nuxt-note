export const primaryColors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

export const neutralColors = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
] as const;

export function resolveThemeColor<T extends string>(
  value: unknown,
  colors: readonly T[],
  fallback: T,
): T {
  return colors.find((color) => color === value) ?? fallback;
}
