<script setup lang="ts">
import { renderMarkdown } from "~/utils/markdown";
const props = defineProps<{ content: string }>();
const rendered = computed(() => renderMarkdown(props.content));
</script>

<template>
  <!-- Only HTML-disabled MarkdownIt output reaches this sink; covered by markdown safety tests. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="chat-markdown" v-html="rendered" />
</template>
