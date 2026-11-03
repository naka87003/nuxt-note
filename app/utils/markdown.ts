import MarkdownIt from "markdown-it";

// No HTML or images. Keep a single renderer for Note previews/readers and Chat.
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });
markdown.disable("image");
markdown.validateLink = (url) => {
  const normalized = Array.from(url.trim())
    .filter((char) => char.charCodeAt(0) > 32 && char.charCodeAt(0) !== 127)
    .join("");
  const protocol = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1];
  return (
    !protocol || ["http", "https", "mailto"].includes(protocol.toLowerCase())
  );
};
export function renderMarkdown(content: string) {
  return markdown.render(content);
}
