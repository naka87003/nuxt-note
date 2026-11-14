<script setup lang="ts">
import { INPUT_LIMITS } from "#shared/utils/input-limits";
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

const { mode, current, location, filter, createLocation } = useWorkspace();
const { data: categories } = useNuxtData<CategoriesResponse>(
  "workspace-categories",
);

const route = useRoute();
const list = useTemplateRef("list");
const searchInput = useTemplateRef("searchInput");
const now = useState("workspace-list-now", () => new Date().toISOString());

const itemCountLabel = computed(() => `${props.items.length} ${mode.value}`);
const searchLabel = computed(() => `Search ${mode.value}`);
const searchPlaceholder = computed(() =>
  filter.value === "all"
    ? `${searchLabel.value}…`
    : `Search in ${props.heading}…`,
);
const searchAriaLabel = computed(
  () => `${searchLabel.value}: ${props.heading}`,
);
const listDescription = computed(() =>
  current.value.search
    ? `Searching ${props.heading}`
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

function clearSearch() {
  current.value.search = "";
  searchInput.value?.inputRef?.focus();
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
      <div class="list-heading">
        <div class="list-heading-title">
          <h1
            class="min-w-0 flex-1 line-clamp-2 text-xl font-semibold wrap-anywhere"
            :title="heading"
          >
            {{ heading }}
          </h1>
          <UTooltip text="Hide list">
            <UButton
              type="button"
              icon="i-lucide-panel-left-close"
              color="neutral"
              variant="ghost"
              size="sm"
              class="group list-toggle size-8 shrink-0 justify-center"
              :ui="{
                leadingIcon:
                  'size-5 text-dimmed/80 transition-colors group-hover:text-default group-focus-visible:text-default',
              }"
              aria-label="Hide list"
              @click="current.hidden = true"
            />
          </UTooltip>
        </div>
        <div class="list-heading-actions">
          <span v-if="!loading" class="shrink-0 text-xs text-dimmed">
            {{ itemCountLabel }}
          </span>
          <UButton
            :to="createLocation(filter)"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            size="sm"
            class="ms-auto shrink-0 font-bold"
          >
            {{ mode === "notes" ? "New note" : "New Chat" }}
          </UButton>
        </div>
      </div>
      <UInput
        ref="searchInput"
        v-model="current.search"
        :maxlength="INPUT_LIMITS.search"
        :placeholder="searchPlaceholder"
        :aria-label="searchAriaLabel"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="current.search.length" #trailing>
          <UButton
            type="button"
            color="neutral"
            variant="link"
            size="sm"
            icon="i-lucide-circle-x"
            aria-label="Clear search"
            @click="clearSearch"
          />
        </template>
      </UInput>
      <p class="mt-3 text-xs text-dimmed" aria-live="polite">
        {{ listDescription }}
      </p>
    </div>
    <div ref="list" class="list-scroll" :aria-busy="loading" @scroll="onScroll">
      <ContentLoading v-if="loading" class="flex-none px-0" />
      <UAlert
        v-else-if="failed"
        color="error"
        title="Could not load your content"
      >
        <template #description>
          <UButton color="neutral" variant="link" @click="emit('retry')">
            Try again
          </UButton>
        </template>
      </UAlert>
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
                  <TypewriterText
                    v-if="mode === 'chats'"
                    :text="itemTitle(item)"
                  />
                  <template v-else>{{ itemTitle(item) }}</template>
                </h3>
                <p
                  v-if="item.preview"
                  class="mt-1 line-clamp-2 text-xs wrap-break-word text-dimmed"
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

<style scoped>
.workspace-list {
  display: flex;
  flex-direction: column;
  flex: 0 0 340px;
  min-height: 0;
  min-width: 0;
  border-right: 1px solid var(--ui-border);
}
.list-controls {
  padding: 16px 16px 8px;
}
.list-heading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}
.list-heading-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 32px;
}
.list-heading-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
}
.list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 16px 16px;
}
.content-list-item {
  display: block;
  min-height: 88px;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.content-list-item:hover,
.content-list-item.active {
  background: var(--ui-bg-elevated);
}
.content-list-item.active h3 {
  color: var(--ui-primary);
}
@media (min-width: 768px) and (max-width: 959px) {
  .workspace-list {
    flex-basis: 280px;
  }
}
@media (max-width: 767px) {
  .list-toggle {
    display: none;
  }
  .workspace-list {
    flex: 1;
    border: 0;
  }
  .list-controls :deep(button),
  .list-controls :deep(a) {
    min-height: 44px;
  }
}
.content-list-item:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
}
</style>
