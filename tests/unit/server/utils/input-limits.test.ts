import { describe, expect, it, vi } from "vitest";
import { normalizeNoteContent } from "../../../../server/utils/notes";
import {
  createNoteInputSchema,
  requestIdSchema,
} from "../../../../server/utils/input-schemas";
import { parseInput } from "../../../../server/utils/parse-input";
import { categoryName } from "../../../../server/utils/categories";
import { contentQuery } from "../../../../server/utils/content-query";
import { messageInput } from "../../../../server/utils/chat-generation";
import { createNoteTools } from "../../../../server/utils/note-tools";

vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
vi.mock("../../../../server/utils/prisma", () => ({ getPrisma: vi.fn() }));

const messageId = "11111111-1111-4111-8111-111111111111";
const fields = [
  {
    name: "category",
    limit: 20,
    validate: (text: string) => categoryName({ name: text }),
  },
  {
    name: "title",
    limit: 50,
    validate: (text: string) =>
      parseInput(createNoteInputSchema, { title: text, markdown: "" }),
  },
  {
    name: "body",
    limit: 5000,
    validate: (text: string) =>
      parseInput(createNoteInputSchema, { title: "Title", markdown: text }),
  },
  {
    name: "search",
    limit: 50,
    validate: (text: string) => contentQuery({ q: text }, "markdown"),
  },
  {
    name: "message",
    limit: 2000,
    validate: (text: string) => messageInput({ messageId, content: text }),
  },
];

describe.each(fields)("$name character limit", ({ limit, validate }) => {
  it.each(["a", "あ", "😀"])(
    "matches browser UTF-16 counting for %s at the boundary",
    (character) => {
      const exact = character.repeat(limit / character.length);
      expect(() => validate(exact)).not.toThrow();
      expect(() => validate(exact + "a")).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    },
  );
});

it("accepts normalization expansion of a valid category name", () => {
  expect(categoryName({ name: "㍿".repeat(20) }).nameKey).toHaveLength(80);
});

describe("input validation compatibility", () => {
  it.each([null, [], "text", 42, undefined])(
    "preserves errors for invalid bodies: %j",
    (body) => {
      expect(() => parseInput(createNoteInputSchema, body)).toThrow(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: "Invalid note",
        }),
      );
      for (const [validate, statusMessage] of [
        [categoryName, "Invalid category"],
        [messageInput, "Invalid message"],
      ] as const) {
        expect(() => validate(body)).toThrow(
          expect.objectContaining({ statusCode: 400, statusMessage }),
        );
      }
    },
  );

  it("preserves normalization, note whitespace, and additional request fields", () => {
    const note = parseInput(createNoteInputSchema, {
      title: "  ",
      markdown: "  body\n",
      categoryId: null,
      extra: true,
    });
    expect(normalizeNoteContent(note)).toEqual({
      title: "Untitled note",
      markdown: "  body\n",
    });
    expect(note.categoryId).toBeNull();
    expect(categoryName({ name: " ＡbＣ ", extra: true })).toEqual({
      name: "ＡbＣ",
      nameKey: "abc",
    });
    expect(
      messageInput({ messageId, content: "  hello\n", chatId: messageId }),
    ).toEqual({ id: messageId, content: "hello" });
  });

  it("checks limits before trimming", () => {
    expect(() =>
      messageInput({ messageId, content: " ".repeat(2000) + "x" }),
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => categoryName({ name: " ".repeat(20) + "x" })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("preserves request ID validation and error priority", () => {
    expect(parseInput(requestIdSchema, messageId.toUpperCase())).toBe(
      messageId.toUpperCase(),
    );
    for (const id of [
      null,
      42,
      "11111111-1111-5111-8111-111111111111",
      ` ${messageId}`,
    ]) {
      expect(() => messageInput({ messageId: id, content: "" })).toThrow(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: "Invalid request ID",
        }),
      );
    }
  });

  it.each([{ q: ["search"] }, { category: ["all"] }, { q: null }])(
    "rejects non-string filters: %j",
    (query) => {
      expect(() => contentQuery(query, "markdown")).toThrow(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: "Invalid filter or search",
        }),
      );
    },
  );

  it("uses the same UTF-16 limits for MCP and API note content", () => {
    const tools = createNoteTools("owner", "https://notes.example");
    for (const input of [
      { title: "😀".repeat(25) + "a", markdown: "" },
      { title: "", markdown: "😀".repeat(2500) + "a" },
    ]) {
      expect(tools.create_note.inputSchema.safeParse(input).success).toBe(
        false,
      );
      expect(() => parseInput(createNoteInputSchema, input)).toThrow(
        expect.objectContaining({ statusCode: 400 }),
      );
    }
    expect(
      tools.list_notes.inputSchema.safeParse({ q: "😀".repeat(25) + "a" })
        .success,
    ).toBe(false);
  });
});
