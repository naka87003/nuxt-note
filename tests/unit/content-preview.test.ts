import { describe, expect, it } from "vitest";
import { contentPreview } from "../../server/utils/content-preview";

describe("content previews", () => {
  it("extracts readable text from Markdown links, images, lists and code", () => {
    expect(
      contentPreview(
        "# Heading\n\n- **Bold** [link](https://example.com)\n- ![Diagram](image.png)\n\n`code`\n\n```ts\nconst value = 1;\n```",
      ),
    ).toBe("Heading Bold link Diagram code const value = 1;");
  });

  it("collapses whitespace and handles empty content", () => {
    expect(contentPreview("  \n\t")).toBe("");
    expect(contentPreview("First line\nsecond line\n\nNext paragraph")).toBe(
      "First line second line Next paragraph",
    );
  });

  it("limits previews without splitting emoji", () => {
    expect(contentPreview("🙂".repeat(161))).toBe(`${"🙂".repeat(160)}…`);
    expect(contentPreview("a".repeat(160))).toBe("a".repeat(160));
  });
});
