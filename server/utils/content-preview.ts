import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: false });

function tokenText(tokens: ReturnType<typeof markdown.parse>): string {
  return tokens
    .map((token) => {
      if (token.children) return tokenText(token.children);
      if (["text", "code_inline", "code_block", "fence"].includes(token.type))
        return token.content;
      if (["softbreak", "hardbreak"].includes(token.type) || token.block)
        return " ";
      return "";
    })
    .join("");
}

export function contentPreview(content: string): string {
  const text = tokenText(markdown.parse(content, {}))
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  return characters.length > 160
    ? `${characters.slice(0, 160).join("")}…`
    : text;
}
