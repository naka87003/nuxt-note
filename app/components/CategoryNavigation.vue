<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from "@nuxt/ui";
import type { CategoriesResponse } from "#shared/types/workspace";
import { sortCategoriesByCount } from "#shared/utils/categories";

const props = defineProps<{
  data: CategoriesResponse | null | undefined;
  loading: boolean;
  failed: boolean;
  drawer?: boolean;
}>();

const emit = defineEmits<{
  select: [filter: string];
  switch: [mode: string];
  create: [];
  rename: [id: string, name: string];
  delete: [id: string, name: string];
  retry: [];
}>();

const { mode, filter } = useWorkspace();

const sortedCategories = computed(() =>
  sortCategoriesByCount(props.data?.items ?? []),
);

const tabs: TabsItem[] = [
  { label: "Notes", value: "notes", icon: "i-lucide-file-text" },
  { label: "Chat", value: "chats", icon: "i-lucide-message-circle" },
];

const navigation = computed(() => [
  {
    id: "all",
    name: mode.value === "notes" ? "All notes" : "All chats",
    count: props.data?.totals[mode.value] ?? 0,
    icon: "i-lucide-files",
  },
  {
    id: "uncategorized",
    name: "Uncategorized",
    count: props.data?.uncategorized[mode.value] ?? 0,
    icon: "i-lucide-folder",
  },
]);

function categoryMenuItems(
  category: CategoriesResponse["items"][number],
): DropdownMenuItem[] {
  return [
    {
      label: "Rename",
      icon: "i-lucide-pencil",
      onSelect: () => emit("rename", category.id, category.name),
    },
    {
      label: "Delete category",
      icon: "i-lucide-trash-2",
      onSelect: () => emit("delete", category.id, category.name),
    },
  ];
}
</script>

<template>
  <div class="category-navigation" :class="{ 'in-drawer': drawer }">
    <nav aria-label="Categories" class="category-scroll">
      <UAlert
        v-if="failed"
        title="Could not load categories"
        color="error"
        class="mb-3"
      >
        <template #description>
          <UButton variant="link" color="neutral" @click="emit('retry')">
            Try again
          </UButton>
        </template>
      </UAlert>
      <button
        v-for="item in navigation"
        :key="item.id"
        class="category-item"
        :class="{ active: filter === item.id }"
        :aria-current="filter === item.id ? 'page' : undefined"
        @click="emit('select', item.id)"
      >
        <UIcon :name="item.icon" class="size-5 shrink-0" /><span
          class="flex-1 text-left"
        >
          {{ item.name }}
        </span>
        <span class="category-count">{{ loading ? "…" : item.count }}</span>
      </button>
      <h2 class="mt-5 mb-2 text-sm font-semibold">Categories</h2>
      <div
        v-for="category in sortedCategories"
        :key="category.id"
        class="category-row"
      >
        <button
          class="category-item min-w-0 flex-1"
          :class="{ active: filter === category.id }"
          :aria-current="filter === category.id ? 'page' : undefined"
          :title="category.name"
          @click="emit('select', category.id)"
        >
          <UIcon name="i-lucide-folder" class="size-5 shrink-0" />
          <span class="flex-1 truncate text-left">{{ category.name }}</span>
          <span class="category-count">{{ category._count[mode] }}</span>
        </button>
        <UDropdownMenu :items="categoryMenuItems(category)">
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="ghost"
            class="category-menu"
            :aria-label="`Manage ${category.name}`"
          />
        </UDropdownMenu>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-plus"
        block
        class="mt-3 font-bold"
        @click="emit('create')"
      >
        New category
      </UButton>
    </nav>
    <footer class="category-footer">
      <p class="mb-3 text-xs text-dimmed">
        {{ data?.totals[mode] ?? 0 }}
        {{ mode === "notes" ? "notes" : "chats" }} ·
        {{ data?.items.length ?? 0 }} categories
      </p>
      <UTabs
        :model-value="mode"
        :items="tabs"
        variant="pill"
        color="primary"
        size="sm"
        :content="false"
        :ui="{
          root: 'workspace-tabs',
          list: 'workspace-tab-list',
          trigger: 'workspace-tab-trigger',
          indicator: 'workspace-tab-indicator',
          leadingIcon: 'size-4',
          label: 'text-xs font-medium leading-4',
        }"
        @update:model-value="emit('switch', String($event))"
      />
    </footer>
  </div>
</template>
