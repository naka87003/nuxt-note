import shiki from "@comark/nuxt/plugins/shiki/core";
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

export default shiki({
  themes: { dark: githubDark },
  languages: [
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
  inlineCode: false,
});
