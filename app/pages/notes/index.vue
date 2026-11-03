<script setup lang="ts">
import { groupNotesByUpdatedAt } from "#shared/utils/note-date-groups";

definePageMeta({ middleware: "auth" });
const { data: notes, error, refresh } = await useFetch("/api/notes");
const groups = computed(() => groupNotesByUpdatedAt(notes.value ?? []));
</script>

<template>
  <UContainer class="max-w-4xl py-8 sm:py-12">
    <div class="mb-8 flex items-center justify-between gap-4">
      <h1 class="text-3xl font-bold">All notes</h1>
      <UButton to="/notes/new" icon="i-lucide-plus" class="min-h-11"
        >New note</UButton
      >
    </div>
    <UAlert v-if="error" title="Could not load your notes" color="error">
      <template #description>
        <UButton variant="link" color="neutral" @click="refresh()"
          >Try again</UButton
        >
      </template>
    </UAlert>
    <UCard v-else-if="!notes?.length" class="text-center">
      <div class="space-y-5 py-8">
        <UIcon name="i-lucide-notebook-pen" class="size-10 text-primary" />
        <h2 class="text-2xl font-bold">Your notebook starts here.</h2>
        <p class="text-dimmed">Capture your first idea in a new note.</p>
        <UButton to="/notes/new" icon="i-lucide-plus" class="min-h-11"
          >Create your first note</UButton
        >
      </div>
    </UCard>
    <div v-else class="space-y-8">
      <section v-for="group in groups" :key="group.label">
        <h2 class="mb-3 text-sm font-medium text-dimmed">{{ group.label }}</h2>
        <ul class="space-y-2">
          <li v-for="note in group.notes" :key="note.id">
            <NuxtLink
              :to="`/notes/${note.id}`"
              class="flex min-h-16 items-center gap-3 rounded-lg border border-default p-4 hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
            >
              <UIcon
                name="i-lucide-file-text"
                class="size-5 shrink-0 text-primary"
              />
              <span class="min-w-0 break-words font-semibold">{{
                note.title
              }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </UContainer>
</template>
