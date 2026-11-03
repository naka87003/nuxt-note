<script setup lang="ts">
import { groupNotesByUpdatedAt } from "#shared/utils/note-date-groups";
import type { WorkspaceItem } from "#shared/types/workspace";
const props = defineProps<{
  items: WorkspaceItem[];
  heading: string;
  loading: boolean;
  failed: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
const { mode, current, location, filter } = useWorkspace();
const route = useRoute();
const list = useTemplateRef("list");
const now = useState("workspace-list-now", () => new Date().toISOString());
const groups = computed(() =>
  current.value.search
    ? [{ label: "Search results", notes: props.items }]
    : groupNotesByUpdatedAt(props.items, new Date(now.value)),
);
const selected = computed(() =>
  typeof route.params.id === "string"
    ? route.params.id
    : route.path.endsWith("/new") || mode.value === "chats"
      ? ""
      : current.value.selected,
);
onMounted(() => {
  if (list.value) list.value.scrollTop = current.value.scroll;
});
watch(mode, async () => {
  await nextTick();
  if (list.value) list.value.scrollTop = current.value.scroll;
});
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
</script>

<template>
  <section class="workspace-list" aria-label="Content list">
    <div class="list-controls">
      <div class="flex min-h-12 items-center gap-2">
        <h1 class="min-w-0 truncate text-xl font-semibold">{{ heading }}</h1>
        <span class="shrink-0 text-xs text-dimmed"
          >{{ items.length }} {{ mode === "notes" ? "notes" : "chats" }}</span
        >
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="list-toggle ml-auto shrink-0 font-bold"
          @click="current.hidden = true"
          >Hide list</UButton
        >
      </div>
      <UInput
        v-model="current.search"
        :maxlength="500"
        :placeholder="mode === 'notes' ? 'Search notes…' : 'Search chats…'"
        :aria-label="`${mode === 'notes' ? 'Search notes' : 'Search chats'}: ${current.scope === 'all' ? 'all categories' : heading}`"
        class="w-full"
      />
      <div
        v-if="filter !== 'all'"
        class="mt-2 flex gap-2"
        role="group"
        aria-label="Search scope"
      >
        <UButton
          :variant="current.scope === 'all' ? 'solid' : 'ghost'"
          :color="current.scope === 'all' ? 'primary' : 'neutral'"
          block
          size="xs"
          class="flex-1 justify-center font-bold"
          @click="current.scope = 'all'"
          >{{ mode === "notes" ? "All notes" : "All chats" }}</UButton
        >
        <UButton
          :variant="current.scope === 'category' ? 'solid' : 'ghost'"
          :color="current.scope === 'category' ? 'primary' : 'neutral'"
          block
          size="xs"
          class="min-w-0 flex-1 justify-center font-bold"
          @click="current.scope = 'category'"
          >In {{ heading }}</UButton
        >
      </div>
      <p class="mt-3 text-xs text-dimmed" aria-live="polite">
        {{
          current.search
            ? `Searching ${current.scope === "all" ? "all categories" : heading}`
            : "Grouped by last updated"
        }}
      </p>
    </div>
    <div
      ref="list"
      class="list-scroll"
      @scroll="current.scroll = ($event.target as HTMLElement).scrollTop"
    >
      <UAlert v-if="failed" color="error" title="Could not load your content">
        <template #description
          ><UButton color="neutral" variant="link" @click="emit('retry')"
            >Try again</UButton
          ></template
        >
      </UAlert>
      <p v-else-if="loading" class="py-5 text-sm text-dimmed" role="status">
        Loading…
      </p>
      <p v-else-if="!items.length" class="py-5 text-sm text-dimmed">
        {{
          current.search
            ? "No results found."
            : mode === "notes"
              ? "No notes here yet."
              : "No chats here yet."
        }}
      </p>
      <template v-else>
        <section v-for="group in groups" :key="group.label" class="mb-4">
          <h2 class="mb-2 text-xs font-medium">{{ group.label }}</h2>
          <ul class="space-y-2">
            <li v-for="item in group.notes" :key="item.id">
              <NuxtLink
                :to="
                  location(
                    `/${mode}/${item.id}`,
                    mode === 'chats'
                      ? (item.categoryId ?? 'uncategorized')
                      : filter,
                  )
                "
                class="content-list-item"
                :class="{ active: selected === item.id }"
                :aria-current="selected === item.id ? 'page' : undefined"
              >
                <h3 class="line-clamp-2 text-sm font-medium">
                  {{
                    item.title ||
                    (mode === "notes" ? "Untitled note" : "Untitled chat")
                  }}
                </h3>
                <p class="mt-2 text-xs text-dimmed">
                  <ClientOnly
                    >{{ date(item.updatedAt)
                    }}<template #fallback>Saved</template></ClientOnly
                  >
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>
