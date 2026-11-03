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
    "[x](vbscript:hello)",
    "[x](file:///etc/passwd)",
    "[x](ftp://example.com/file)",
    "[x](java&#x73;cript:alert%281%29)",
    "[x](JaVaScRiPt:alert%281%29)",
    "<iframe src=javascript:alert(1)></iframe>",
    "<NuxtLink to=javascript:alert(1)>x</NuxtLink>",
    "![tracking](https://example.com/track)",
  ])("does not render unsafe HTML or images: %s", (source) => {
    const html = renderChatMarkdown(source);
    expect(html).not.toMatch(
      /<script|<img|<iframe|<NuxtLink|href="(?:javascript|data|vbscript|file|ftp):/i,
    );
  });
});

it("preserves safe links, relative links and anchors", () => {
  for (const url of [
    "https://nuxt.com",
    "http://example.com",
    "mailto:a@example.com",
    "/notes",
    "#example",
  ]) {
    expect(renderChatMarkdown(`[link](${url})`)).toContain(`href="${url}"`);
  }
});
it("renders code as escaped text, including HTML and component-like tags", () => {
  const html = renderChatMarkdown(
    "```html\n<script>alert(1)</script>\n<NoteEditor />\n```",
  );
  expect(html.replace(/<\/?span[^>]*>/g, "")).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<NoteEditor");
});
