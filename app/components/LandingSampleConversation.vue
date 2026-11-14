<script setup lang="ts">
import { landingConversations } from "~/utils/landing-conversations";

const props = withDefaults(defineProps<{ notesAware?: boolean }>(), {
  notesAware: false,
});
const conversation = computed(() =>
  props.notesAware
    ? landingConversations.savedNotes
    : landingConversations.useFetch,
);
</script>

<template>
  <div class="sample-conversation">
    <h3>{{ conversation.title }}</h3>
    <p class="sample-question">{{ conversation.question }}</p>
    <LandingMarkdownContent variant="chat" :content="conversation.answer" />
    <div class="sample-composer">
      <span class="text-dimmed">Ask anything…</span>
      <span class="sample-send">
        <img src="/icons/chat-send.svg" width="20" height="20" alt="" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.sample-conversation {
  --landing-code-size: 14px;
  --landing-code-radius: 4px;
  --landing-code-white-space: pre;
  --landing-code-wrap: normal;
  font-size: 16px;
  line-height: 1.6;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 16px 32px;
  gap: 16px;
}
.sample-conversation h3 {
  font-size: 24px;
  line-height: 1.35;
  font-weight: 600;
  margin-bottom: 8px;
}
.sample-question {
  align-self: flex-end;
  width: 70%;
  padding: 16px;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
}
.sample-composer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  border: 1px solid var(--ui-border);
  border-radius: 28.8px;
  padding: 12px 12px 12px 19.2px;
  margin-top: auto;
}
.sample-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ui-primary);
  opacity: 0.5;
}
@media (max-width: 767px) {
  .sample-conversation {
    --landing-code-white-space: pre-wrap;
    --landing-code-wrap: anywhere;
  }
}
</style>
