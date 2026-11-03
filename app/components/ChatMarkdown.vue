<script setup lang="ts">
import { renderChatMarkdown } from "~/utils/chat-markdown";
const props = defineProps<{ content: string }>();
const rendered = computed(() => renderChatMarkdown(props.content));
</script>
<!-- HTML is produced only by html:false MarkdownIt; safety is covered by chat-markdown.test.ts. -->
<template>
  <!-- eslint-disable vue/no-v-html -->
  <div class="chat-markdown" v-html="rendered" />
</template>
