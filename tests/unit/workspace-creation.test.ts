import { computed, reactive, ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkspace } from "../../app/composables/useWorkspace";
import type { CategoriesResponse } from "#shared/types/workspace";

const route = reactive({
  path: "/chats",
  query: {} as { category?: string },
});
const categories = ref<CategoriesResponse>({
  items: [{ id: "nuxt", name: "Nuxt", _count: { notes: 1, chats: 1 } }],
  totals: { notes: 1, chats: 1 },
  uncategorized: { notes: 0, chats: 0 },
});

beforeEach(() => {
  route.path = "/chats";
  route.query = {};
  categories.value.items[0]!.name = "Nuxt";
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useState", (_key: string, initial: () => unknown) =>
    ref(initial()),
  );
  vi.stubGlobal("useNuxtData", () => ({ data: categories }));
  vi.stubGlobal("useNuxtApp", () => ({
    $unsavedChanges: { confirm: vi.fn() },
  }));
});

it.each(["notes", "chats"])(
  "creates uncategorized %s from the header even inside a category",
  (mode) => {
    route.path = `/${mode}/saved`;
    route.query.category = "nuxt";
    const workspace = useWorkspace();
    expect(workspace.createLocation()).toEqual({
      path: `/${mode}/new`,
      query: { category: "uncategorized" },
    });
    expect(workspace.filter.value).toBe("nuxt");
  },
);

it.each(
  ["notes", "chats"].flatMap((mode) =>
    ["all", "uncategorized", "nuxt"].map(
      (category) => [mode, category] as const,
    ),
  ),
)(
  "uses the correct creation destination and label for %s / %s",
  (mode, category) => {
    route.path = `/${mode}`;
    route.query.category = category;
    const workspace = useWorkspace();
    expect(workspace.createLocation(workspace.filter.value)).toEqual({
      path: `/${mode}/new`,
      query: { category: category === "all" ? "uncategorized" : category },
    });
    expect(workspace.selectedCategoryName.value).toBe(
      category === "nuxt" ? "Nuxt" : undefined,
    );
  },
);

it("updates the destination and category label when switching filters without remounting", () => {
  const workspace = useWorkspace();
  route.query.category = "nuxt";
  expect(workspace.selectedCategoryName.value).toBe("Nuxt");
  categories.value.items[0]!.name =
    "Nuxt / Server Rendering and Authentication";
  expect(workspace.selectedCategoryName.value).toBe(
    "Nuxt / Server Rendering and Authentication",
  );
  route.query.category = "uncategorized";
  expect(workspace.selectedCategoryName.value).toBeUndefined();
  expect(workspace.createLocation(workspace.filter.value).query.category).toBe(
    "uncategorized",
  );
});
