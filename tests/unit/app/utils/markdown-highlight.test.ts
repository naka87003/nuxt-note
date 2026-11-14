import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render-markdown";
import { createNoteMarkdownParser } from "@/utils/markdown";
import { textContent } from "@comark/nuxt/utils";
import type { ElementNode } from "@comark/nuxt/parse";

async function parsedCode(source: string) {
  const document = await createNoteMarkdownParser()(source);
  return document.nodes.find(
    (node) => Array.isArray(node) && node[0] === "pre",
  ) as ElementNode;
}

const withoutSpans = (html: string) => html.replace(/<\/?span[^>]*>/g, "");

describe("shared GitHub Dark Markdown", () => {
  it("uses the Figma palette in both Notes and Chat", async () => {
    const source =
      "```ts\n// Fetch notes\nconst data = await useFetch('/api/notes')\n```";
    const html = await renderMarkdown(source);
    for (const color of ["F97583", "B392F0", "9ECBFF", "6A737D"]) {
      expect(html).toContain(`color:#${color}`);
    }
    expect(withoutSpans(html)).toContain(
      "// Fetch notes\nconst data = await useFetch('/api/notes')",
    );
  });

  it.each([
    ["js", "const x = 1"],
    ["javascript", "const x = 1"],
    ["ts", "const x: number = 1"],
    ["typescript", "const x: number = 1"],
    ["jsx", "const x = <div />"],
    ["tsx", "const x = <div />"],
    ["vue", '<template><div v-if="ok">Hello</div></template>'],
    ["html", '<a href="/notes">Notes</a>'],
    ["css", "a { color: red; }"],
    ["json", '{"ok": true}'],
    ["bash", 'echo "hello"'],
    ["sh", 'echo "hello"'],
    ["python", 'print("hello")'],
    ["py", 'print("hello")'],
    ["sql", "SELECT * FROM notes;"],
    ["md", "# Heading"],
    ["markdown", "# Heading"],
    ["mdc", "::callout\nHello\n::"],
    ["php", '<?php echo "hello";'],
    ["blade", "<div>{{ $name }}</div>"],
    ["yaml", "name: note"],
    ["yml", "name: note"],
    ["diff", "+added"],
  ])("highlights %s", async (language, code) => {
    expect(
      await renderMarkdown(`\`\`\`${language}\n${code}\n\`\`\``),
    ).toContain('<span style="color:#');
  });

  it.each([
    "",
    "text",
    "plaintext",
    "unknown-language",
    'x" onmouseover="alert(1)',
  ])("escapes unhighlighted fences (%s)", async (language) => {
    const html = await renderMarkdown(
      `\`\`\`${language}\n<script>& test</script>\n\`\`\``,
    );
    expect(
      textContent(
        await parsedCode(`\`\`\`${language}\n<script>& test</script>\n\`\`\``),
      ),
    ).toBe("<script>& test</script>");
    expect(html).not.toMatch(/<script| onmouseover="/);
  });

  it("keeps inline code plain and indented code readable", async () => {
    const html = await renderMarkdown(
      "`<img src=x>`\n\n    <script>alert(1)</script>",
    );
    expect(html).toContain("<code>&lt;img src=x&gt;</code>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it.each(["html", "vue", "js", "md"])(
    "treats malicious %s code as text",
    async (language) => {
      const html = await renderMarkdown(
        `\`\`\`${language}\n</code></pre><img src=x onerror=alert(1)>\n<NuxtLink to="javascript:alert(1)">x</NuxtLink>\n\`\`\``,
      );
      expect(html).not.toMatch(/<img|<NuxtLink|<script/);
      expect(withoutSpans(html)).toContain("&lt;/code&gt;&lt;/pre&gt;&lt;img");
      expect(html.match(/<pre(?:\s[^>]*)?>/g)).toHaveLength(1);
      expect(html.match(/<\/pre>/g)).toHaveLength(1);
    },
  );

  it("preserves whitespace and handles incomplete streaming fences", async () => {
    const code = '\tconst x = "<tag>";\n\n  // trailing spaces  \n';
    const open = await renderMarkdown(`\`\`\`js\n${code}`);
    const closed = await renderMarkdown(`\`\`\`js\n${code}\`\`\``);
    expect(open).toBe(closed);
    expect(textContent(await parsedCode(`\`\`\`js\n${code}`))).toBe(
      code.slice(0, -1),
    );
    expect(textContent(await parsedCode('```js\nconst x = "'))).toBe(
      'const x = "',
    );
  });

  it.each(["a".repeat(2_001), "short line\n".repeat(2_001)])(
    "keeps long code intact with the standard highlighter",
    async (code) => {
      expect(textContent(await parsedCode(`\`\`\`js\n${code}\n\`\`\``))).toBe(
        code,
      );
    },
  );
});
