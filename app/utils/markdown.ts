import { createSerializedMarkdownParser } from "@comark/nuxt/parse";
import security from "@comark/nuxt/plugins/security";
import codeHighlight from "./code-highlight";

export function createNoteMarkdownParser() {
  return createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    headingIds: false,
    autoClose: false,
    plugins: [
      security({
        blockedTags: ["img"],
        allowedProtocols: ["http", "https", "mailto"],
      }),
      codeHighlight,
    ],
  });
}
