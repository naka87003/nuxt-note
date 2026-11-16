<script setup lang="ts">
import { getErrorStatusMessage } from "~/utils/http-error";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

const props = defineProps<{
  operation: "create" | "rename" | "delete";
  categoryId: string;
  name: string;
  onSaved: (deletedCategoryId?: string) => Promise<void>;
}>();

const open = defineModel<boolean>("open", { required: true });
const categoryLabel = ref("");
const busy = ref(false);
const failure = ref("");
const toast = useToast();

const dialogTitle = computed(() =>
  props.operation === "create"
    ? "New category"
    : props.operation === "rename"
      ? "Rename category"
      : "Delete category",
);

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;

    categoryLabel.value = props.name;
    failure.value = "";
  },
  { immediate: true },
);

async function saveCategory() {
  if (busy.value || !open.value) return;

  if (
    props.operation !== "delete" &&
    categoryLabel.value.length > INPUT_LIMITS.categoryName
  ) {
    failure.value = `Use at most ${INPUT_LIMITS.categoryName} characters for the category name.`;

    return;
  }

  busy.value = true;
  failure.value = "";

  try {
    if (props.operation === "create") {
      await $fetch("/api/categories", {
        method: "POST",
        body: { name: categoryLabel.value },
      });
    } else if (props.operation === "rename") {
      await $fetch(`/api/categories/${props.categoryId}`, {
        method: "PATCH",
        body: { name: categoryLabel.value },
      });
    } else {
      await $fetch(`/api/categories/${props.categoryId}`, {
        method: "DELETE",
      });
    }
  } catch (error) {
    failure.value =
      getErrorStatusMessage(error) ??
      "Could not update the category. Please try again.";

    busy.value = false;

    return;
  }

  open.value = false;

  try {
    await props.onSaved(
      props.operation === "delete" ? props.categoryId : undefined,
    );
  } catch {
    toast.add({
      title:
        props.operation === "delete" ? "Category deleted" : "Category saved",
      description:
        "The change was saved, but the view could not be refreshed. Reload to see the latest content.",
      color: "warning",
      icon: "i-lucide-triangle-alert",
    });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="dialogTitle"
    :dismissible="!busy"
    :close="!busy"
  >
    <template #body>
      <form id="category-form" class="space-y-4" @submit.prevent="saveCategory">
        <UAlert v-if="failure" color="error" :title="failure" role="alert" />
        <p v-if="operation === 'delete'">
          Delete “{{ categoryLabel }}”? Notes and conversations in this category
          will become Uncategorized. No notes, conversations, or messages will
          be deleted.
        </p>
        <UFormField
          v-else
          label="Name"
          name="name"
          required
          :hint="`${categoryLabel.length} / ${INPUT_LIMITS.categoryName}`"
        >
          <UInput
            v-model="categoryLabel"
            autofocus
            :maxlength="INPUT_LIMITS.categoryName"
            :disabled="busy"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="busy"
        @click="open = false"
      >
        Cancel
      </UButton>
      <UButton
        type="submit"
        form="category-form"
        :color="operation === 'delete' ? 'error' : 'primary'"
        :loading="busy"
        :disabled="operation !== 'delete' && !categoryLabel.trim()"
      >
        {{ operation === "delete" ? "Delete category" : "Save" }}
      </UButton>
    </template>
  </UModal>
</template>
