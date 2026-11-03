<script setup lang="ts">
import { renderMarkdown } from "~/utils/markdown";
const props = defineProps<{ content: string }>();
const rendered = computed(() => renderMarkdown(props.content));
</script>

<template>
  <!-- HTML-disabled MarkdownIt + escaped syntax tokens only; covered by safety tests. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="chat-markdown" v-html="rendered" />
</template>
