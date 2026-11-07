import type { CategoriesResponse } from "#shared/types/workspace";

export function useWorkspace() {
  const route = useRoute();

  const state = useState("workspace", () => ({
    filter: "all",
    notes: {
      search: "",
      selected: "",
      scroll: 0,
      hidden: false,
    },
    chats: {
      search: "",
      selected: "",
      scroll: 0,
      hidden: false,
    },
    editor: { active: false, dirty: false, busy: false },
  }));

  const mode = computed(() =>
    route.path.startsWith("/chats") ? ("chats" as const) : ("notes" as const),
  );

  const current = computed(() => state.value[mode.value]);

  const filter = computed(() =>
    typeof route.query.category === "string"
      ? route.query.category
      : state.value.filter,
  );

  const categoryId = computed(() =>
    !["all", "uncategorized"].includes(filter.value) ? filter.value : null,
  );

  function location(path: string, category = filter.value) {
    return { path, query: { category } };
  }

  function createLocation(category = "uncategorized") {
    return location(
      `/${mode.value}/new`,
      category === "all" ? "uncategorized" : category,
    );
  }

  const { data: categories } = useNuxtData<CategoriesResponse>(
    "workspace-categories",
  );
  const selectedCategoryName = computed(
    () =>
      categories.value?.items.find((item) => item.id === categoryId.value)
        ?.name,
  );

  const { $unsavedChanges } = useNuxtApp();

  async function confirmEdits() {
    if (state.value.editor.busy) return false;
    return !state.value.editor.dirty || (await $unsavedChanges.confirm());
  }

  return {
    state,
    mode,
    current,
    filter,
    categoryId,
    selectedCategoryName,
    location,
    createLocation,
    confirmEdits,
  };
}
