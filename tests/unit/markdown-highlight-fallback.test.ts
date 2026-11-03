import { expect, it, vi } from "vitest";

vi.mock("shiki/core", () => ({
  createHighlighterCoreSync: () => {
    throw new Error("Highlighting unavailable");
  },
}));

it("keeps escaped Markdown readable if the highlighter fails", async () => {
  const { renderMarkdown } = await import("../../app/utils/markdown");
  expect(renderMarkdown("```js\n<script>alert(1)</script>\n```")).toBe(
    '<pre><code class="language-js">&lt;script&gt;alert(1)&lt;/script&gt;\n</code></pre>\n',
  );
});
