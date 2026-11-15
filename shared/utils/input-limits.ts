// Match HTML maxlength and JavaScript String.length (UTF-16 code units).
export const INPUT_LIMITS = {
  categoryName: 20,
  noteTitle: 50,
  search: 50,
  chatMessage: 2_000,
  noteBody: 5_000,
} as const;

// Chat titles use Unicode code points, matching the generated title limit.
export const MAX_CHAT_TITLE_CHARACTERS = 80;
