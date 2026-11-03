import { describe, expect, it } from "vitest";
import {
  parseCsv,
  prepareNotes,
  sourceDate,
  stableId,
} from "../../scripts/lib/notebook-import.mjs";

describe("Notebook migration", () => {
  it("preserves multiline bodies, commas, quotes, CRLF and trailing empty fields", () => {
    expect(parseCsv('\uFEFFid,body,tag\r\n1,"a,b\r\n""code""",\r\n')).toEqual([
      { id: "1", body: 'a,b\r\n"code"', tag: "" },
    ]);
    expect(parseCsv('id,body\n1,""')).toEqual([{ id: "1", body: "" }]);
  });
  it("rejects corrupt CSV instead of importing partial content", () => {
    for (const csv of [
      'id,body\n1,"open',
      'id,body\n1,"body"oops',
      "id,body\n1,2,3",
      "id,id\n1,2",
    ])
      expect(() => parseCsv(csv)).toThrow();
  });
  it("converts Tokyo timestamps to UTC across year boundaries", () => {
    expect(sourceDate("2026-01-01 00:30:00")).toBe("2025-12-31 15:30:00.000");
    expect(() => sourceDate("2026-02-30 00:00:00")).toThrow();
    expect(() => sourceDate("")).toThrow();
  });
  const note = {
    id: "1",
    user_id: "12",
    category_id: "1",
    status_id: "1",
    tag_id: "4",
    title: "",
    content: "\nFirst line\n```js\nx()\n```",
    created_at: "2026-01-01 00:30:00",
    updated_at: "2026-01-02 00:30:00",
    image_path: "ignored.png",
  };
  const tag = { id: "4", user_id: "12", name: " ＡＢＣ " };
  it("filters owners, maps tags, leaves untagged notes uncategorized, and omits images", () => {
    const result = prepareNotes(
      [
        note,
        { ...note, id: "2", tag_id: "" },
        { ...note, id: "3", user_id: "1" },
      ],
      [tag],
      "12",
      "target",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      title: "First line",
      markdown: note.content,
      categoryName: "ＡＢＣ",
      categoryKey: "abc",
      createdAt: "2025-12-31 15:30:00.000",
    });
    expect(result[0]).not.toHaveProperty("image_path");
    expect(result[1].categoryKey).toBeNull();
  });
  it("rejects missing/foreign tags, duplicate IDs and unsupported status", () => {
    expect(() => prepareNotes([note], [], "12", "target")).toThrow();
    expect(() =>
      prepareNotes([note], [{ ...tag, user_id: "1" }], "12", "target"),
    ).toThrow();
    expect(() => prepareNotes([note, note], [tag], "12", "target")).toThrow();
    expect(() =>
      prepareNotes([{ ...note, status_id: "2" }], [tag], "12", "target"),
    ).toThrow();
  });
  it("keeps import identity stable and isolates different target owners", () => {
    expect(stableId("target", "note", "12:1")).toBe(
      stableId("target", "note", "12:1"),
    );
    expect(stableId("target", "note", "12:1")).not.toBe(
      stableId("other", "note", "12:1"),
    );
  });
});
