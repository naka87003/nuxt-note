import { beforeEach, expect, it } from "vitest";
import {
  clearNuxtState,
  clearNuxtData,
  useNuxtData,
  useNuxtApp,
  useRouter,
  useUserSession,
} from "#imports";
import { mountComposable } from "../helpers/mount-composable";
import { useWorkspace } from "~/composables/useWorkspace";
import type { CategoriesResponse } from "#shared/types/workspace";

let categories: ReturnType<typeof useNuxtData<CategoriesResponse>>["data"];
beforeEach(() => {
  clearNuxtState("workspace");
  clearNuxtData("workspace-categories");
  useNuxtApp().$unsavedChanges.resolve(false);
  useUserSession().session.value = {
    id: "test-session",
    user: {
      id: "owner",
      githubLogin: "fixture",
      name: "Fixture",
      avatarUrl: "",
    },
  };
  categories = useNuxtData<CategoriesResponse>("workspace-categories").data;
  categories.value = {
    items: [{ id: "nuxt", name: "Nuxt", _count: { notes: 1, chats: 1 } }],
    totals: { notes: 1, chats: 1 },
    uncategorized: { notes: 0, chats: 0 },
  };
});

it.each(["notes", "chats"])(
  "creates uncategorized %s from the header even inside a category",
  async (mode) => {
    const { result: workspace } = await mountComposable(
      () => useWorkspace(),
      `/${mode}/new?category=nuxt`,
    );
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
  async (mode, category) => {
    const { result: workspace } = await mountComposable(
      () => useWorkspace(),
      `/${mode}?category=${category}`,
    );
    expect(workspace.createLocation(workspace.filter.value)).toEqual({
      path: `/${mode}/new`,
      query: { category: category === "all" ? "uncategorized" : category },
    });
    expect(workspace.selectedCategoryName.value).toBe(
      category === "nuxt" ? "Nuxt" : undefined,
    );
  },
);

it("updates the destination and category label when switching filters without remounting", async () => {
  const { result: workspace } = await mountComposable(
    () => useWorkspace(),
    "/chats?category=nuxt",
  );
  expect(workspace.selectedCategoryName.value).toBe("Nuxt");
  // Nuxt async data is shallow: refreshes replace the response snapshot.
  categories.value = {
    ...categories.value!,
    items: [
      {
        ...categories.value!.items[0]!,
        name: "Nuxt / Server Rendering and Authentication",
      },
    ],
  };
  expect(workspace.selectedCategoryName.value).toBe(
    "Nuxt / Server Rendering and Authentication",
  );
  await useRouter().push("/chats?category=uncategorized");
  expect(workspace.selectedCategoryName.value).toBeUndefined();
  expect(workspace.createLocation(workspace.filter.value).query.category).toBe(
    "uncategorized",
  );
});

it("shares workspace state between consumers and uses the confirmation plugin", async () => {
  const { result: first } = await mountComposable(
    () => useWorkspace(),
    "/chats",
  );
  const { result: second } = await mountComposable(() => useWorkspace());
  first.current.value.search = "Shared search";
  expect(second.current.value.search).toBe("Shared search");
  first.state.value.editor.dirty = true;
  const decision = second.confirmEdits();
  const confirmation = useNuxtApp().$unsavedChanges;
  expect(confirmation.open.value).toBe(true);
  confirmation.resolve(false);
  await expect(decision).resolves.toBe(false);
});
