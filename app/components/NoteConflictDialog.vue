<script setup lang="ts">
defineProps<{
  saving?: boolean;
  failure?: string;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ overwrite: [] }>();
</script>

<template>
  <UModal
    v-model:open="open"
    title="Overwrite this note?"
    :dismissible="!saving"
    :close="!saving"
  >
    <template #body>
      <UAlert
        title="This note was updated elsewhere"
        color="warning"
        icon="i-lucide-triangle-alert"
      />
      <p class="mt-4 text-sm">
        Overwrite the saved title, body, and category with your changes?
      </p>
      <UAlert
        v-if="failure"
        title="Save failed"
        :description="failure"
        color="error"
        role="alert"
        class="mt-4"
      />
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="saving"
        @click="open = false"
      >
        Keep editing
      </UButton>
      <UButton
        color="primary"
        :loading="saving"
        :disabled="saving"
        @click="emit('overwrite')"
      >
        Overwrite and save
      </UButton>
    </template>
  </UModal>
</template>
