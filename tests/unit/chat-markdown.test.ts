import { describe, expect, it } from "vitest";
import { renderChatMarkdown } from "../../app/utils/chat-markdown";
describe("Chat Markdown", () => {
  it("renders code, tables, lists and safe links", () => {
    const html = renderChatMarkdown(
      "## Example\n\n- item\n\n```js\nconst a = 1;\n```\n\n[Nuxt](https://nuxt.com)\n\n| A | B |\n| - | - |\n| 1 | 2 |",
    );
    expect(html).toContain("<h2>Example</h2>");
    expect(html).toContain('<code class="language-js">');
    expect(html).toContain('<a href="https://nuxt.com">');
    expect(html).toContain("<table>");
  });
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "[x](javascript:alert(1))",
    "[x](data:text/html,hello)",
    "![tracking](https://example.com/track)",
  ])("does not render unsafe HTML or images: %s", (source) => {
    const html = renderChatMarkdown(source);
    expect(html).not.toMatch(/<script|<img|href="(?:javascript|data):/);
  });
});
