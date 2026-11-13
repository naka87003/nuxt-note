<script setup lang="ts">
definePageMeta({ key: "chat", middleware: "auth", layout: "workspace" });

const route = useRoute();
const config = useRuntimeConfig();

const chatId = () =>
  typeof route.params.id === "string" && route.params.id !== "new"
    ? route.params.id
    : "";

function createNoteLinkDraft(note: unknown): string {
  if (
    typeof note !== "string" ||
    !note ||
    note.length > 100 ||
    /[\\/\s?#:]/.test(note)
  )
    return "";

  const url = new URL(
    `/notes/${encodeURIComponent(note)}`,
    config.public.siteUrl,
  );
  return `${url.href}\n\n`;
}

let revision = 0;
function newSession() {
  const id = chatId();
  return {
    key: revision,
    id,
    initialDraft: id ? "" : createNoteLinkDraft(route.query.note),
  };
}
const session = ref(newSession());

watch([() => route.path, () => route.query.note], () => {
  const id = chatId();
  if (id && id === session.value.id) return;
  revision++;
  session.value = newSession();
});
</script>

<template>
  <div class="chat-page">
    <ChatSession
      :key="session.key"
      :chat-id="session.id"
      :initial-draft="session.initialDraft"
      @created="session.id = $event"
    />
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
</style>
