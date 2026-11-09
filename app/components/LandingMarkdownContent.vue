<script setup lang="ts">
withDefaults(
  defineProps<{
    content: string;
    variant?: "document" | "note" | "chat";
  }>(),
  { variant: "document" },
);
</script>

<template>
  <div
    class="markdown-content landing-markdown"
    :class="`landing-markdown--${variant}`"
  >
    <Suspense>
      <MarkdownRenderer :content="content" :copyable="false" />
    </Suspense>
  </div>
</template>

<style scoped src="~/assets/css/markdown.css" />

<style scoped>
.landing-markdown :deep(.comark-content) {
  display: contents;
}
.landing-markdown :deep(pre) {
  padding: var(--landing-code-padding, 16px);
  border-radius: var(--landing-code-radius, 6px);
  background: var(--ui-bg-muted);
}
.landing-markdown--document :deep(.comark-content > * + *) {
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
  font-size: 24px;
  line-height: 1.35;
  margin-bottom: 8px;
}
.landing-markdown--note :deep(h4) {
  font-weight: 600;
  font-size: 20px;
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
