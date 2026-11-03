<script setup lang="ts">
const { $unsavedChanges } = useNuxtApp();
const { open, resolve } = $unsavedChanges;
</script>

<template>
  <UModal
    :open="open"
    title="Discard unsaved changes?"
    description="Your note has changes that have not been saved."
    @update:open="!$event && resolve(false)"
  >
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        class="min-h-11"
        @click="resolve(false)"
        >Keep editing</UButton
      >
      <UButton color="error" class="min-h-11" @click="resolve(true)"
        >Discard changes</UButton
      >
    </template>
  </UModal>
</template>
