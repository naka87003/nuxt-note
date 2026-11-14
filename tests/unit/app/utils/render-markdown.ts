import { render } from "@comark/nuxt/render";
import { createNoteMarkdownParser } from "@/utils/markdown";

export async function renderMarkdown(source: string) {
  const document = await createNoteMarkdownParser()(source);
  return render(document, { format: "text/html" });
}
