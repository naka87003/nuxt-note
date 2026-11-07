<script setup lang="ts">
import { renderMarkdown } from "~/utils/markdown";

const props = withDefaults(
  defineProps<{
    content: string;
    variant?: "document" | "note" | "chat";
  }>(),
  { variant: "document" },
);

const rendered = computed(() => renderMarkdown(props.content));
</script>

<template>
  <!-- Use the shared, HTML-disabled renderer with landing-specific typography. -->
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="landing-markdown"
    :class="`landing-markdown--${variant}`"
    v-html="rendered"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<style scoped>
.landing-markdown {
  white-space: normal;
  overflow-wrap: anywhere;
}
.landing-markdown :deep(h1),
.landing-markdown :deep(h2),
.landing-markdown :deep(h3) {
  font-weight: 600;
  line-height: 1.3;
}
.landing-markdown :deep(h1) {
  font-size: 1.5rem;
}
.landing-markdown :deep(h2) {
  font-size: 1.25rem;
}
.landing-markdown :deep(h3) {
  font-size: 1.125rem;
}
.landing-markdown :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}
.landing-markdown :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}
.landing-markdown :deep(pre) {
  max-width: 100%;
  overflow: auto;
  padding: var(--landing-code-padding, 16px);
  border-radius: var(--landing-code-radius, 6px);
  background: var(--ui-bg-muted);
  color: #e1e4e8;
  white-space: pre;
  overflow-wrap: normal;
}
.landing-markdown :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.875em;
}
.landing-markdown :deep(:not(pre) > code) {
  background: var(--ui-bg-muted);
  padding: 2px 4px;
  border-radius: 4px;
}
.landing-markdown :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
.landing-markdown :deep(blockquote) {
  border-left: 3px solid var(--ui-border-accented);
  padding-left: 16px;
  color: var(--ui-text-dimmed);
}
.landing-markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.landing-markdown :deep(th),
.landing-markdown :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 8px;
}
.landing-markdown--document :deep(> * + *) {
  margin-top: 1rem;
}
.landing-markdown--chat {
  /* Let each answer block participate in the conversation's flex spacing. */
  display: contents;
}
.landing-markdown--chat :deep(pre),
.landing-markdown--note :deep(pre) {
  font-size: var(--landing-code-size, 11px);
  white-space: var(--landing-code-white-space, pre-wrap);
  overflow-wrap: var(--landing-code-wrap, anywhere);
}
.landing-markdown--chat :deep(pre > code),
.landing-markdown--note :deep(pre > code) {
  font-size: inherit;
}
.landing-markdown--note :deep(h3) {
  font-size: 22px;
  line-height: 1.35;
  margin-bottom: 8px;
}
.landing-markdown--note :deep(h4) {
  font-weight: 600;
  font-size: 16px;
  margin-block: 24px 10px;
}
.landing-markdown--note :deep(pre) {
  margin-top: 16px;
}
.landing-markdown--note :deep(ul) {
  padding-left: 16px;
}
.landing-markdown--note :deep(blockquote) {
  border: 0;
  color: inherit;
  background: var(--ui-bg-muted);
  padding: 12px;
  margin-top: 16px;
}
</style>
