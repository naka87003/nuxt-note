import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import bash from "shiki/langs/bash.mjs";
import blade from "shiki/langs/blade.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import mdc from "shiki/langs/mdc.mjs";
import php from "shiki/langs/php.mjs";
import python from "shiki/langs/python.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import vue from "shiki/langs/vue.mjs";
import yaml from "shiki/langs/yaml.mjs";

let highlighter: ReturnType<typeof createHighlighterCoreSync> | undefined;
const cache = new Map<string, string>();

// A bounded cache reuses completed fences while another Chat fence is streaming.
// Only bundled grammars/themes are used; source tokens are escaped below.
export function highlightCode(
  code: string,
  language: string,
  escapeHtml: (text: string) => string,
): string {
  const lang = language.toLowerCase();
  if (
    !lang ||
    code.length > 20_000 ||
    code.split("\n").some((line) => line.length > 2_000)
  ) {
    return "";
  }

  try {
    highlighter ??= createHighlighterCoreSync({
      themes: [githubDark],
      langs: [
        bash,
        blade,
        css,
        diff,
        html,
        javascript,
        json,
        jsx,
        markdown,
        mdc,
        php,
        python,
        sql,
        tsx,
        typescript,
        vue,
        yaml,
      ],
      engine: createJavaScriptRegexEngine(),
    });
    if (!highlighter.getLoadedLanguages().includes(lang)) return "";

    const key = `${lang}\0${code}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      theme: "github-dark",
    });
    const result = tokens
      .map((line) =>
        line
          .map((token) => {
            const text = escapeHtml(token.content);
            // Only theme-provided hex colors become attributes; source is always text.
            return token.color && /^#[\da-f]{6}$/i.test(token.color)
              ? `<span style="color:${token.color}">${text}</span>`
              : text;
          })
          .join(""),
      )
      .join("\n");
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch {
    // MarkdownIt escapes the original code when highlighting is unavailable.
    return "";
  }
}
