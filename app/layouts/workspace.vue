<script setup lang="ts">
import { useEventListener, useMediaQuery } from "@vueuse/core";
import { INPUT_LIMITS } from "#shared/utils/input-limits";
import type { WorkspaceItem } from "#shared/types/workspace";

const route = useRoute();
const {
  state,
  mode,
  current,
  filter,
  selectedCategoryName,
  location,
  createLocation,
} = useWorkspace();

const workspaceRoot = useTemplateRef("workspaceRoot");

const drawer = ref(false);
const sidebar = ref(true);
const desktop = useMediaQuery("(min-width: 1280px)");

watch(desktop, (matches) => {
  if (matches) drawer.value = false;
});

const sidebarToggleIcon = computed(() =>
  sidebar.value ? "i-lucide-panel-left-close" : "i-lucide-panel-left-open",
);

onMounted(() => {
  const viewport = window.visualViewport;
  const fitKeyboard = () => {
    // Let pinch zoom pan naturally instead of resizing the app around it.
    if (!workspaceRoot.value || (viewport && viewport.scale !== 1)) return;
    // iOS can pan the visual viewport after focusing an input, independently
    // of resizing it. Keep both edges of the workspace inside the visible area.
    workspaceRoot.value.style.top = `${viewport?.offsetTop ?? 0}px`;
    workspaceRoot.value.style.height = `${viewport?.height ?? window.innerHeight}px`;
  };
  fitKeyboard();
  if (viewport) useEventListener(viewport, ["resize", "scroll"], fitKeyboard);
});

const listQuery = useWorkspaceListQuery(
  mode,
  filter,
  computed(() => current.value.search),
);

const [
  {
    data: categories,
    error: categoriesError,
    status: categoriesStatus,
    refresh: refreshCategories,
  },
  { data: items, error: listError, status: listStatus, refresh: refreshList },
] = await Promise.all([
  useFetch("/api/categories", { key: "workspace-categories" }),
  useFetch<WorkspaceItem[]>(() => `/api/${mode.value}`, {
    query: listQuery,
    key: "workspace-list",
  }),
]);

const heading = computed(() =>
  filter.value === "all"
    ? mode.value === "notes"
      ? "All notes"
      : "All chats"
    : filter.value === "uncategorized"
      ? "Uncategorized"
      : (selectedCategoryName.value ?? "Category"),
);

const isContent = computed(
  () => Boolean(route.params.id) || route.path.endsWith("/new"),
);

const isEditor = computed(
  () => route.path === "/notes/new" || state.value.editor.active,
);

const listHidden = computed(() => current.value.hidden || isEditor.value);

const categoryDialog = ref(false);

const operation = ref<"create" | "rename" | "delete">("create");

const categoryTarget = ref("");

const categoryLabel = ref("");

const busy = ref(false);

const failure = ref("");

const dialogTitle = computed(() =>
  operation.value === "create"
    ? "New category"
    : operation.value === "rename"
      ? "Rename category"
      : "Delete category",
);

watch(
  () => route.fullPath,
  () => {
    state.value.filter = filter.value;
    if (typeof route.params.id === "string")
      current.value.selected = route.params.id;
    drawer.value = false;
  },
  { immediate: true },
);

async function go(path: string, category = filter.value) {
  await navigateTo(location(path, category));
  // A cancelled navigation leaves the drawer and controlled Tabs unchanged.
  if (route.path === path && filter.value === category) drawer.value = false;
}

async function editCategory(
  action: "create" | "rename" | "delete",
  id = "",
  name = "",
) {
  if (state.value.editor.busy) return;
  if (state.value.editor.dirty) {
    await navigateTo(location("/notes"));
    if (route.path !== "/notes") return;
  }
  operation.value = action;
  categoryTarget.value = id;
  categoryLabel.value = name;
  failure.value = "";
  categoryDialog.value = true;
}
async function saveCategory() {
  if (busy.value) return;
  if (
    operation.value !== "delete" &&
    categoryLabel.value.length > INPUT_LIMITS.categoryName
  ) {
    failure.value = `Use at most ${INPUT_LIMITS.categoryName} characters for the category name.`;
    return;
  }
  busy.value = true;
  failure.value = "";
  try {
    if (operation.value === "create")
      await $fetch("/api/categories", {
        method: "POST",
        body: { name: categoryLabel.value },
      });
    else if (operation.value === "rename")
      await $fetch(`/api/categories/${categoryTarget.value}`, {
        method: "PATCH",
        body: { name: categoryLabel.value },
      });
    else {
      await $fetch(`/api/categories/${categoryTarget.value}`, {
        method: "DELETE",
      });
      if (filter.value === categoryTarget.value) {
        state.value.filter = "uncategorized";
        await navigateTo(location(route.path, "uncategorized"), {
          replace: true,
        });
      }
    }
    categoryDialog.value = false;
    await refreshNuxtData();
  } catch (error) {
    const response = error as { data?: { statusMessage?: string } };
    failure.value =
      response.data?.statusMessage ??
      "Could not update the category. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div ref="workspaceRoot" class="workspace-root">
    <header class="workspace-header">
      <div class="workspace-header-side gap-2 sm:gap-4">
        <UButton
          icon="i-lucide-panel-left-open"
          color="neutral"
          variant="ghost"
          class="group workspace-menu"
          :ui="{
            leadingIcon:
              'text-dimmed/80 transition-colors group-hover:text-default group-focus-visible:text-default',
          }"
          aria-label="Toggle categories"
          :aria-expanded="drawer"
          @click="drawer = true"
        />
        <UTooltip text="Toggle categories">
          <UButton
            :icon="sidebarToggleIcon"
            color="neutral"
            variant="ghost"
            class="group desktop-menu"
            :ui="{
              leadingIcon:
                'text-dimmed/80 transition-colors group-hover:text-default group-focus-visible:text-default',
            }"
            aria-label="Toggle categories"
            :aria-expanded="sidebar"
            @click="sidebar = !sidebar"
          />
        </UTooltip>
        <UButton :to="createLocation()" icon="i-lucide-plus" class="font-bold">
          {{ mode === "notes" ? "New note" : "New Chat" }}
        </UButton>
      </div>
      <NuxtLink to="/" aria-label="Nuxt Note home" class="workspace-brand">
        <AppBrand />
      </NuxtLink>
      <div class="workspace-header-side justify-end">
        <ThemePicker />
        <ProfileMenu />
      </div>
    </header>
    <div
      class="workspace-body"
      :class="{ 'has-content': isContent, 'list-hidden': listHidden }"
    >
      <aside v-show="sidebar" class="desktop-categories">
        <CategoryNavigation
          :data="categories"
          :loading="categoriesStatus === 'pending'"
          :failed="!!categoriesError"
          @select="go(`/${mode}`, $event)"
          @switch="go(`/${$event}`)"
          @create="editCategory('create')"
          @rename="(id, name) => editCategory('rename', id, name)"
          @delete="(id, name) => editCategory('delete', id, name)"
          @retry="refreshCategories()"
        />
      </aside>
      <WorkspaceList
        :items="items ?? []"
        :heading="heading"
        :loading="listStatus === 'pending'"
        :failed="!!listError"
        @retry="refreshList()"
      />
      <div v-if="listHidden && !isEditor" class="workspace-list-rail">
        <UTooltip text="Show list" :content="{ side: 'right' }">
          <UButton
            type="button"
            icon="i-lucide-panel-left-open"
            color="neutral"
            variant="ghost"
            size="sm"
            class="group list-toggle size-8 shrink-0 justify-center"
            :ui="{
              leadingIcon:
                'size-5 text-dimmed/80 transition-colors group-hover:text-default group-focus-visible:text-default',
            }"
            aria-label="Show list"
            @click="current.hidden = false"
          />
        </UTooltip>
      </div>
      <main class="workspace-content">
        <div v-if="!isEditor" class="pane-navigation">
          <UButton
            :to="location(`/${mode}`)"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            class="mobile-back"
            aria-label="Back to list"
          >
            Back
          </UButton>
        </div>
        <slot />
      </main>
    </div>
    <USlideover
      v-model:open="drawer"
      side="left"
      title="Navigation"
      description="Choose a category or workspace"
      :ui="{
        content: 'category-drawer',
        body: 'p-0 sm:p-0 min-h-0 flex flex-col',
        header: 'min-h-14',
        close: 'min-h-11 min-w-11',
      }"
    >
      <template #body>
        <CategoryNavigation
          drawer
          :data="categories"
          :loading="categoriesStatus === 'pending'"
          :failed="!!categoriesError"
          @select="go(`/${mode}`, $event)"
          @switch="go(`/${$event}`)"
          @create="editCategory('create')"
          @rename="(id, name) => editCategory('rename', id, name)"
          @delete="(id, name) => editCategory('delete', id, name)"
          @retry="refreshCategories()"
        />
      </template>
    </USlideover>
    <UModal
      v-model:open="categoryDialog"
      :title="dialogTitle"
      :dismissible="!busy"
      :close="!busy"
    >
      <template #body>
        <form
          id="category-form"
          class="space-y-4"
          @submit.prevent="saveCategory"
        >
          <UAlert v-if="failure" color="error" :title="failure" role="alert" />
          <p v-if="operation === 'delete'">
            Delete “{{ categoryLabel }}”? Notes and conversations in this
            category will become Uncategorized. No notes, conversations, or
            messages will be deleted.
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
          @click="categoryDialog = false"
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
  </div>
</template>

<style scoped>
.workspace-root {
  position: fixed;
  inset: 0 0 auto;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.workspace-header {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 16px;
  background: var(--ui-bg-muted);
  border-bottom: 1px solid var(--ui-border);
}
.workspace-header-side {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.workspace-brand {
  flex: 1;
  display: flex;
  justify-content: center;
}
.workspace-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.desktop-categories {
  flex: 0 0 288px;
  min-height: 0;
  box-shadow: inset -1px 0 var(--ui-border);
  background: var(--ui-bg-muted);
}
.workspace-content {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.pane-navigation {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.list-hidden .workspace-list {
  display: none;
}
.workspace-list-rail {
  display: flex;
  flex: 0 0 40px;
  flex-direction: column;
  align-items: center;
  padding: 16px 4px;
  box-shadow: inset -1px 0 var(--ui-border);
}
/* Slideover content is teleported outside the layout DOM. */
:global(.category-drawer) {
  top: 64px;
  height: calc(100dvh - 64px);
  width: min(320px, calc(100vw - 44px));
  background: var(--ui-bg-muted);
}
.workspace-menu,
.mobile-back {
  display: none;
}
@media (max-width: 1279px) {
  .desktop-categories,
  .desktop-menu {
    display: none !important;
  }
  .workspace-menu {
    display: inline-flex;
  }
}
@media (max-width: 767px) {
  .workspace-content,
  .workspace-list-rail,
  .list-toggle {
    display: none;
  }
  .has-content .workspace-list {
    display: none;
  }
  .has-content .workspace-content {
    display: flex;
  }
  .list-hidden:not(.has-content) .workspace-list {
    display: flex;
  }
  .mobile-back {
    display: inline-flex;
    min-height: 44px;
  }
  .pane-navigation {
    min-height: 44px;
  }
  .workspace-header :deep(button),
  .workspace-header :deep(a:not(.workspace-brand)) {
    min-height: 44px;
  }
  .workspace-menu {
    min-width: 44px;
  }
  .has-content .pane-navigation {
    position: absolute;
    z-index: 10;
    top: 0;
    left: 0;
  }
  .has-content
    .workspace-content:has(.note-reader, .chat-session)
    > .pane-navigation {
    top: 8px;
  }
}
@media (max-width: 639px) {
  .workspace-brand {
    display: none;
  }
  .workspace-header {
    padding-inline: 12px;
  }
  .workspace-header-side:first-child {
    flex: auto;
  }
}
</style>
