import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../../../app/utils/markdown";

const withoutSpans = (html: string) => html.replace(/<\/?span[^>]*>/g, "");

describe("shared GitHub Dark Markdown", () => {
  it("uses the Figma palette in both Notes and Chat", () => {
    const source =
      "```ts\n// Fetch notes\nconst data = await useFetch('/api/notes')\n```";
    const html = renderMarkdown(source);
    for (const color of ["F97583", "B392F0", "9ECBFF", "6A737D"]) {
      expect(html).toContain(`color:#${color}`);
    }
    expect(withoutSpans(html)).toContain(
      "// Fetch notes\nconst data = await useFetch('/api/notes')\n",
    );
  });

  it.each([
    ["js", "const x = 1"],
    ["javascript", "const x = 1"],
    ["TS", "const x: number = 1"],
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
  ])("highlights %s", (language, code) => {
    expect(renderMarkdown(`\`\`\`${language}\n${code}\n\`\`\``)).toContain(
      '<span style="color:#',
    );
  });

  it.each([
    "",
    "text",
    "plaintext",
    "unknown-language",
    'x" onmouseover="alert(1)',
  ])("escapes unhighlighted fences (%s)", (language) => {
    const html = renderMarkdown(
      `\`\`\`${language}\n<script>& test</script>\n\`\`\``,
    );
    expect(html).toContain("&lt;script&gt;&amp; test&lt;/script&gt;");
    expect(html).not.toContain("<span");
    expect(html).not.toMatch(/<script| onmouseover="/);
  });

  it("keeps inline and indented code escaped without token markup", () => {
    const html = renderMarkdown(
      "`<img src=x>`\n\n    <script>alert(1)</script>",
    );
    expect(html).toContain("<code>&lt;img src=x&gt;</code>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<span");
  });

  it.each(["html", "vue", "js", "md"])(
    "treats malicious %s code as text",
    (language) => {
      const html = renderMarkdown(
        `\`\`\`${language}\n</code></pre><img src=x onerror=alert(1)>\n<NuxtLink to="javascript:alert(1)">x</NuxtLink>\n\`\`\``,
      );
      expect(html).not.toMatch(/<img|<NuxtLink|<script/);
      expect(withoutSpans(html)).toContain("&lt;/code&gt;&lt;/pre&gt;&lt;img");
      expect(html.match(/<pre>/g)).toHaveLength(1);
      expect(html.match(/<\/pre>/g)).toHaveLength(1);
    },
  );

  it("preserves whitespace and handles incomplete streaming fences", () => {
    const code = '\tconst x = "<tag>";\n\n  // trailing spaces  \n';
    const open = renderMarkdown(`\`\`\`js\n${code}`);
    const closed = renderMarkdown(`\`\`\`js\n${code}\`\`\``);
    expect(open).toBe(closed);
    expect(withoutSpans(open)).toContain(
      "\tconst x = &quot;&lt;tag&gt;&quot;;\n\n  // trailing spaces  \n",
    );
    expect(renderMarkdown('```js\nconst x = "')).toContain("<pre><code");
  });

  it.each(["a".repeat(2_001), "short line\n".repeat(2_001)])(
    "falls back for expensive blocks",
    (code) => {
      const html = renderMarkdown(`\`\`\`js\n${code}\n\`\`\``);
      expect(html).not.toContain("<span");
      expect(html).toContain(code);
    },
  );
});
