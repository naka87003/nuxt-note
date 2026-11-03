<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "workspace" });
const route = useRoute();
const { state, location } = useWorkspace();
const {
  data: chat,
  error,
  refresh,
} = await useFetch(() => `/api/chats/${route.params.id}`);
const { data: categories } = useNuxtData<{
  items: { id: string; name: string }[];
}>("workspace-categories");
const categoryOptions = computed(() => [
  { label: "Uncategorized", value: "uncategorized" },
  ...(categories.value?.items.map((item) => ({
    label: item.name,
    value: item.id,
  })) ?? []),
]);
const assignment = ref(false);
const deletion = ref(false);
const target = ref("uncategorized");
const busy = ref(false);
const failure = ref("");
watch(
  () => chat.value?.id,
  async () => {
    if (!chat.value) return;
    const filter = chat.value.categoryId ?? "uncategorized";
    state.value.filter = filter;
    if (route.query.category !== filter)
      await navigateTo(location(route.path, filter), { replace: true });
  },
  { immediate: true },
);
function assign() {
  target.value = chat.value?.categoryId ?? "uncategorized";
  failure.value = "";
  assignment.value = true;
}
async function saveCategory() {
  if (busy.value || !chat.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const categoryId = target.value === "uncategorized" ? null : target.value;
    await $fetch(`/api/chats/${chat.value.id}`, {
      method: "PATCH",
      body: { categoryId },
    });
    state.value.filter = categoryId ?? "uncategorized";
    await navigateTo(location(route.path, state.value.filter), {
      replace: true,
    });
    assignment.value = false;
    await refreshNuxtData();
  } catch {
    failure.value = "Could not change the category. Please try again.";
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (busy.value || !chat.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/chats/${chat.value.id}`, { method: "DELETE" });
    deletion.value = false;
    state.value.chats.selected = "";
    await refreshNuxtData();
    await navigateTo(location("/chats"));
  } catch {
    failure.value = "Could not delete the chat. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="chat-page">
    <UAlert
      v-if="error"
      title="Could not open this chat"
      color="error"
      class="m-4"
    >
      <template #description
        ><UButton color="neutral" variant="link" @click="refresh()"
          >Try again</UButton
        ></template
      >
    </UAlert>
    <div v-else-if="chat" class="chat-session">
      <div class="chat-actions">
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          class="font-bold"
          @click="assign"
          >Category:
          {{
            categoryOptions.find(
              (item) => item.value === (chat?.categoryId ?? "uncategorized"),
            )?.label ?? "Uncategorized"
          }}</UButton
        >
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          class="font-bold"
          @click="
            failure = '';
            deletion = true;
          "
          >Delete</UButton
        >
      </div>
      <div class="chat-messages">
        <div class="chat-inner space-y-6">
          <h1 class="text-2xl font-semibold break-words">
            {{ chat.title || "Untitled chat" }}
          </h1>
          <div
            v-for="message in chat.messages"
            :key="message.id"
            :class="
              message.role === 'user'
                ? 'chat-user-message'
                : 'chat-assistant-message'
            "
          >
            {{ message.content }}
          </div>
        </div>
      </div>
      <div class="chat-composer-container">
        <div class="chat-inner"><ChatComposer /></div>
      </div>
    </div>
    <UModal
      v-model:open="assignment"
      title="Change category"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body
        ><UAlert
          v-if="failure"
          :title="failure"
          color="error"
          class="mb-4" /><UFormField label="Category"
          ><USelect
            v-model="target"
            :items="categoryOptions"
            :disabled="busy"
            class="w-full" /></UFormField
      ></template>
      <template #footer
        ><UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="assignment = false"
          >Cancel</UButton
        ><UButton :loading="busy" @click="saveCategory">Save</UButton></template
      >
    </UModal>
    <UModal
      v-model:open="deletion"
      title="Delete chat"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body
        ><UAlert v-if="failure" :title="failure" color="error" class="mb-4" />
        <p>
          Permanently delete this conversation and all its messages? This cannot
          be undone.
        </p></template
      >
      <template #footer
        ><UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="deletion = false"
          >Cancel</UButton
        ><UButton color="error" :loading="busy" @click="remove"
          >Delete chat</UButton
        ></template
      >
    </UModal>
  </div>
</template>
