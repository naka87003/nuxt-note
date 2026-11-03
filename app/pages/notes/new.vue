<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "workspace" });
const { loggedIn } = useUserSession();
const { state, categoryId, location, confirmEdits } = useWorkspace();
const title = ref("");
const markdown = ref("");
const saving = ref(false);
const saved = ref(false);
const error = ref("");
const dirty = computed(() => !saved.value && !!(title.value || markdown.value));

async function canLeave() {
  if (!loggedIn.value) return true;
  if (saving.value) return false;
  return await confirmEdits();
}
onBeforeRouteLeave(canLeave);
onBeforeRouteUpdate((to, from) => {
  if (to.fullPath !== from.fullPath) return canLeave();
});
watchEffect(() => {
  state.value.editor = { dirty: dirty.value, busy: saving.value };
});
onBeforeUnmount(() => {
  state.value.editor = { dirty: false, busy: false };
});
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));

async function save() {
  if (saving.value || saved.value) return;
  saving.value = true;
  error.value = "";
  try {
    const note = await $fetch("/api/notes", {
      method: "POST",
      body: {
        title: title.value,
        markdown: markdown.value,
        categoryId: categoryId.value,
      },
    });
    saved.value = true;
    saving.value = false;
    await refreshNuxtData();
    await navigateTo(location(`/notes/${note.id}`));
  } catch {
    error.value =
      "Could not save your note. Your changes are still here. Please try again.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="note-editor">
    <form class="space-y-6" @submit.prevent="save">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-3xl font-bold">New note</h1>
        <div class="flex gap-2">
          <UButton
            :to="location('/notes')"
            variant="ghost"
            color="neutral"
            :disabled="saving"
            class="min-h-11"
            >Cancel</UButton
          >
          <UButton
            type="submit"
            icon="i-lucide-save"
            :loading="saving"
            :disabled="saved"
            class="min-h-11"
            >Save</UButton
          >
        </div>
      </div>
      <UAlert
        v-if="error"
        :description="error"
        title="Save failed"
        color="error"
        role="alert"
      />
      <UFormField label="Title" name="title">
        <UInput
          v-model="title"
          :maxlength="200"
          :disabled="saving || saved"
          placeholder="Untitled note"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Note"
        name="markdown"
        description="Write your note in Markdown."
      >
        <UTextarea
          v-model="markdown"
          :disabled="saving || saved"
          :rows="18"
          placeholder="Start writing…"
          class="w-full"
          :ui="{ base: 'font-mono' }"
        />
      </UFormField>
    </form>
  </div>
</template>
