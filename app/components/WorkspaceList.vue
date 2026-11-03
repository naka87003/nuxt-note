<script setup lang="ts">
import { groupNotesByUpdatedAt } from "#shared/utils/note-date-groups";
import type {
  CategoriesResponse,
  WorkspaceItem,
} from "#shared/types/workspace";

const props = defineProps<{
  items: WorkspaceItem[];
  heading: string;
  loading: boolean;
  failed: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();

const { mode, current, location, filter } = useWorkspace();
const { data: categories } = useNuxtData<CategoriesResponse>(
  "workspace-categories",
);

const route = useRoute();
const list = useTemplateRef("list");
const now = useState("workspace-list-now", () => new Date().toISOString());

const itemCountLabel = computed(() => `${props.items.length} ${mode.value}`);
const searchLabel = computed(() => `Search ${mode.value}`);
const searchScopeLabel = computed(() => props.heading);
const searchPlaceholder = computed(() =>
  filter.value === "all"
    ? `${searchLabel.value}…`
    : `Search in ${props.heading}…`,
);
const searchAriaLabel = computed(
  () => `${searchLabel.value}: ${searchScopeLabel.value}`,
);
const listDescription = computed(() =>
  current.value.search
    ? `Searching ${searchScopeLabel.value}`
    : "Grouped by last updated",
);
const emptyMessage = computed(() =>
  current.value.search ? "No results found." : `No ${mode.value} here yet.`,
);
const untitledLabel = computed(() =>
  mode.value === "notes" ? "Untitled note" : "Untitled chat",
);

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

function itemLocation(item: WorkspaceItem) {
  const category =
    mode.value === "chats"
      ? (item.categoryId ?? "uncategorized")
      : filter.value;
  return location(`/${mode.value}/${item.id}`, category);
}

function itemTitle(item: WorkspaceItem) {
  return item.title || untitledLabel.value;
}

function itemCategory(item: WorkspaceItem) {
  if (!item.categoryId) return "Uncategorized";
  return (
    categories.value?.items.find((category) => category.id === item.categoryId)
      ?.name ?? "Category"
  );
}

function onScroll(event: Event) {
  current.value.scroll = (event.target as HTMLElement).scrollTop;
}

function date(value: string) {
  const updatedAt = new Date(value);
  const oneYearAgo = new Date(now.value);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return updatedAt.toLocaleDateString(undefined, {
    year: updatedAt < oneYearAgo ? "numeric" : undefined,
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
        <span class="shrink-0 text-xs text-dimmed">
          {{ itemCountLabel }}
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="list-toggle ml-auto shrink-0 font-bold"
          @click="current.hidden = true"
        >
          Hide list
        </UButton>
      </div>
      <UInput
        v-model="current.search"
        :maxlength="500"
        :placeholder="searchPlaceholder"
        :aria-label="searchAriaLabel"
        class="w-full"
      />
      <p class="mt-3 text-xs text-dimmed" aria-live="polite">
        {{ listDescription }}
      </p>
    </div>
    <div ref="list" class="list-scroll" @scroll="onScroll">
      <UAlert v-if="failed" color="error" title="Could not load your content">
        <template #description>
          <UButton color="neutral" variant="link" @click="emit('retry')">
            Try again
          </UButton>
        </template>
      </UAlert>
      <p v-else-if="loading" class="py-5 text-sm text-dimmed" role="status">
        Loading…
      </p>
      <p v-else-if="!items.length" class="py-5 text-sm text-dimmed">
        {{ emptyMessage }}
      </p>
      <template v-else>
        <section v-for="group in groups" :key="group.label" class="mb-4">
          <h2 class="mb-2 text-xs font-medium">{{ group.label }}</h2>
          <ul class="space-y-2">
            <li v-for="item in group.notes" :key="item.id">
              <NuxtLink
                :to="itemLocation(item)"
                class="content-list-item"
                :class="{ active: selected === item.id }"
                :aria-current="selected === item.id ? 'page' : undefined"
              >
                <h3 class="line-clamp-2 text-sm font-medium">
                  {{ itemTitle(item) }}
                </h3>
                <p
                  v-if="item.preview"
                  class="mt-1 line-clamp-2 text-xs break-words text-dimmed"
                >
                  {{ item.preview }}
                </p>
                <p class="mt-2 flex items-center gap-1 text-xs text-dimmed">
                  <span class="min-w-0 truncate">{{ itemCategory(item) }}</span>
                  <span aria-hidden="true">·</span>
                  <span class="shrink-0">
                    <ClientOnly>
                      {{ date(item.updatedAt) }}
                      <template #fallback>Saved</template>
                    </ClientOnly>
                  </span>
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>
