import { describe, expect, it, vi } from "vitest";
import { noteContent } from "../../../../server/utils/notes";
import { categoryName } from "../../../../server/utils/categories";
import { contentQuery } from "../../../../server/utils/content-query";
import { messageInput } from "../../../../server/utils/chat-generation";

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
    validate: (text: string) => noteContent({ title: text, markdown: "" }),
  },
  {
    name: "body",
    limit: 5000,
    validate: (text: string) => noteContent({ title: "Title", markdown: text }),
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
