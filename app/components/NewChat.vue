<script setup lang="ts">
const { categoryId, location } = useWorkspace();
const draft = ref("");
const busy = ref(false);
const failure = ref("");
let pending:
  | {
      chatId: string;
      messageId: string;
      content: string;
      categoryId: string | null;
    }
  | undefined;
async function create() {
  if (busy.value || !draft.value.trim()) return;
  if (
    !pending ||
    pending.content !== draft.value.trim() ||
    pending.categoryId !== categoryId.value
  )
    pending = {
      chatId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      content: draft.value.trim(),
      categoryId: categoryId.value,
    };
  busy.value = true;
  failure.value = "";
  try {
    const chat = await $fetch("/api/chats", { method: "POST", body: pending });
    await refreshNuxtData(["workspace-list", "workspace-categories"]);
    await navigateTo(
      location(`/chats/${chat.id}`, pending.categoryId ?? "uncategorized"),
    );
  } catch {
    failure.value = "Could not create your chat. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="new-chat">
    <div class="new-chat-card">
      <h1 class="mb-8 text-center text-xl">Start your chat</h1>
      <UAlert
        v-if="failure"
        :title="failure"
        color="error"
        class="mb-4"
        role="alert"
      />
      <ChatComposer v-model="draft" :disabled="busy" @send="create" />
      <p v-if="busy" class="mt-2 text-sm text-dimmed" role="status">
        Creating chat…
      </p>
    </div>
  </div>
</template>
