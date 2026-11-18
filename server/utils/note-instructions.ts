import { INPUT_LIMITS } from "#shared/utils/input-limits";

export const NOTE_CONTENT_INSTRUCTIONS =
  `Note titles must fit ${INPUT_LIMITS.noteTitle} UTF-16 code units and the complete Markdown body must fit ${INPUT_LIMITS.noteBody} UTF-16 code units, including existing content, whitespace, and Markdown syntax; emoji may count as two units. ` +
  "Plan edits within these limits before calling a tool. If the requested content cannot fit, explain the limit and ask whether to summarize or split it into multiple Notes; never silently truncate or remove existing content. Input validation failures do not save changes; correct invalid arguments only when the requested content can be preserved, otherwise explain the failure. ";
