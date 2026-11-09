<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>();
</script>

<template>
  <div class="markdown-content chat-markdown">
    <Suspense>
      <MarkdownRenderer :content="content" :streaming="streaming" />
    </Suspense>
  </div>
</template>

<style scoped src="~/assets/css/markdown.css" />

<style scoped>
.chat-markdown :deep(.comark-content > * + *) {
  margin-top: 1rem;
}
.chat-markdown :deep(pre) {
  padding: 16px 56px 16px 16px;
}
</style>
