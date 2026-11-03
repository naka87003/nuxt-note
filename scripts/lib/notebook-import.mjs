import { createHash } from "node:crypto";

// Preserve quoted newlines, escaped quotes, empty fields and original text.
export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (c !== ",") {
        rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else if (c === '"' && field === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Invalid CSV quoting");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV field");
  if (row.length || field || closed) rows.push([...row, field]);
  const columns = rows.shift();
  if (!columns || new Set(columns).size !== columns.length)
    throw new Error("Invalid CSV header");
  return rows.map((values) => {
    if (values.length !== columns.length)
      throw new Error("CSV column count mismatch");
    return Object.fromEntries(columns.map((key, i) => [key, values[i]]));
  });
}

export function stableId(targetUserId, kind, sourceId) {
  const hex = createHash("sha256")
    .update(JSON.stringify(["notebook-v1", targetUserId, kind, sourceId]))
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function sourceDate(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))
    throw new Error("Invalid source timestamp");
  const date = new Date(value.replace(" ", "T") + "+09:00");
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19) !==
      value.replace(" ", "T")
  )
    throw new Error("Invalid source date");
  return date.toISOString().replace("T", " ").replace("Z", "");
}

export function prepareNotes(notes, tags, sourceUserId, targetUserId) {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const seen = new Set();
  return notes
    .filter((note) => note.user_id === sourceUserId)
    .map((note) => {
      if (!/^\d+$/.test(note.id) || seen.has(note.id))
        throw new Error("Invalid or duplicate source note ID");
      seen.add(note.id);
      if (note.category_id !== "1" || note.status_id !== "1")
        throw new Error(
          "Unexpected source category/status; review mapping first",
        );
      const tag = note.tag_id ? tagMap.get(note.tag_id) : null;
      if (
        note.tag_id &&
        (!tag || (tag.user_id && tag.user_id !== sourceUserId))
      )
        throw new Error("Missing or foreign tag");
      const name = tag?.name.trim() ?? null;
      const nameKey = name?.normalize("NFKC").toLowerCase() ?? null;
      if (tag && (!name || name.length > 100 || nameKey.length > 100))
        throw new Error("Invalid category name");
      let title =
        note.title.trim() ||
        note.content
          .split(/\r?\n/)
          .find((line) => line.trim())
          ?.trim() ||
        "Untitled note";
      title = title.slice(0, 200).replace(/[\uD800-\uDBFF]$/, "");
      return {
        id: stableId(targetUserId, "note", `${sourceUserId}:${note.id}`),
        sourceId: note.id,
        title,
        markdown: note.content,
        categoryName: name,
        categoryKey: nameKey,
        createdAt: sourceDate(note.created_at),
        updatedAt: sourceDate(note.updated_at),
      };
    });
}
