import { render } from "@comark/vue/render";
import { createNoteMarkdownParser } from "~/utils/markdown";

export async function renderMarkdown(source: string) {
  const document = await createNoteMarkdownParser()(source);

  return render(document, { format: "text/html" });
}
