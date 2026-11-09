import { createMarkdownParser, type Node } from "@comark/nuxt/parse";

const parse = createMarkdownParser({
  registerDefaultPlugins: false,
  autoClose: false,
});
const inlineTags = new Set(["a", "strong", "em", "s", "del", "code", "span"]);

function nodeText(node: Node): string {
  if (typeof node === "string") return node;
  if (node[0] === null) return "";
  if (node[0] === "img") return String(node[1].alt ?? "");
  const text = (node.slice(2) as Node[]).map(nodeText).join("");
  return inlineTags.has(node[0]) ? text : `${text} `;
}

export async function contentPreview(content: string): Promise<string> {
  const document = await parse(content);
  const text = document.nodes
    .map(nodeText)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  return characters.length > 160
    ? `${characters.slice(0, 160).join("")}…`
    : text;
}
