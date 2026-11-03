import MarkdownIt from "markdown-it";
// Raw HTML, remote images, and executable link protocols are never rendered.
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });
markdown.disable("image");
export function renderChatMarkdown(content: string) {
  return markdown.render(content);
}
