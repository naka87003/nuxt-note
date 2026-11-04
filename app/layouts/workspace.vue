<script setup lang="ts">
import type { WorkspaceItem } from "#shared/types/workspace";

const route = useRoute();
const { state, mode, current, filter, location } = useWorkspace();

const workspaceRoot = useTemplateRef("workspaceRoot");

const drawer = ref(false);
const sidebar = ref(true);

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
  viewport?.addEventListener("resize", fitKeyboard);
  viewport?.addEventListener("scroll", fitKeyboard);
  onBeforeUnmount(() => {
    viewport?.removeEventListener("resize", fitKeyboard);
    viewport?.removeEventListener("scroll", fitKeyboard);
  });
  const desktop = window.matchMedia("(min-width: 1280px)");
  const closeDrawer = () => {
    if (desktop.matches) drawer.value = false;
  };
  desktop.addEventListener("change", closeDrawer);
  onBeforeUnmount(() => desktop.removeEventListener("change", closeDrawer));
});

const listQuery = computed(() => ({
  category: filter.value,
  q: current.value.search,
}));

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
      : (categories.value?.items.find((item) => item.id === filter.value)
          ?.name ?? "Category"),
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
          icon="i-lucide-panel-left"
          color="primary"
          variant="soft"
          class="workspace-menu"
          aria-label="Toggle categories"
          :aria-expanded="drawer"
          @click="drawer = true"
        />
        <UButton
          icon="i-lucide-panel-left"
          color="primary"
          variant="soft"
          class="desktop-menu"
          aria-label="Toggle categories"
          :aria-expanded="sidebar"
          @click="sidebar = !sidebar"
        />
        <UButton
          v-if="route.path !== '/chats/new'"
          :class="{
            'mobile-chat-create': mode === 'chats' && !route.params.id,
          }"
          :to="location(`/${mode}/new`)"
          icon="i-lucide-plus"
          class="font-bold"
          >{{ mode === "notes" ? "New note" : "New Chat" }}</UButton
        >
      </div>
      <NuxtLink to="/" aria-label="Nuxt Note home" class="workspace-brand"
        ><AppBrand
      /></NuxtLink>
      <div class="workspace-header-side justify-end"><ProfileMenu /></div>
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
      <main class="workspace-content">
        <div class="pane-navigation">
          <UButton
            :to="location(`/${mode}`)"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            class="mobile-back"
            aria-label="Back to list"
            >Back</UButton
          >
          <UButton
            v-if="listHidden && !isEditor"
            icon="i-lucide-panel-left-open"
            color="neutral"
            variant="ghost"
            size="sm"
            class="list-toggle"
            @click="current.hidden = false"
            >Show list</UButton
          >
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
        body: 'p-0 min-h-0 flex flex-col',
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
          <UFormField v-else label="Name" name="name" required>
            <UInput
              v-model="categoryLabel"
              autofocus
              :maxlength="100"
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
