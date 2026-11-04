<script setup lang="ts">
definePageMeta({ key: "chat", middleware: "auth", layout: "workspace" });

const route = useRoute();
const chatId = () =>
  typeof route.params.id === "string" && route.params.id !== "new"
    ? route.params.id
    : "";
let revision = 0;
const session = ref({ key: revision, id: chatId() });

watch(
  () => route.path,
  () => {
    const id = chatId();
    if (id && id === session.value.id) return;
    session.value = { key: ++revision, id };
  },
);
</script>

<template>
  <div class="chat-page">
    <ChatSession
      :key="session.key"
      :chat-id="session.id"
      @created="session.id = $event"
    />
  </div>
</template>
