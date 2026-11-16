import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import { clearNuxtState, useRouter, useState, useUserSession } from "#imports";
import Workspace from "~/layouts/workspace.vue";
import CategoryNavigation from "~/components/CategoryNavigation.vue";
import WorkspaceCategoryDialog from "~/components/WorkspaceCategoryDialog.vue";
import type { useWorkspace } from "~/composables/useWorkspace";
import type { CategoriesResponse } from "#shared/types/workspace";

const { fetchWorkspace, refreshWorkspace } = vi.hoisted(() => ({
  fetchWorkspace: vi.fn(),
  refreshWorkspace: vi.fn(),
}));

mockNuxtImport("useFetch", () => fetchWorkspace);
mockNuxtImport("refreshNuxtData", () => refreshWorkspace);

afterEach(() => {
  document.getElementById("content")?.remove();
});

beforeEach(() => {
  clearNuxtState();
  fetchWorkspace.mockReset();
  refreshWorkspace.mockReset().mockResolvedValue(undefined);
  useUserSession().session.value = {
    id: "test-session",
    user: {
      id: "owner",
      githubLogin: "fixture",
      name: "Fixture",
      avatarUrl: "",
    },
  };
});

async function mountWorkspace(
  route = "/notes?category=work",
  initialListStatus = "success",
) {
  const categories = ref<CategoriesResponse>({
    items: [{ id: "work", name: "Work", _count: { notes: 1, chats: 0 } }],
    totals: { notes: 1, chats: 0 },
    uncategorized: { notes: 0, chats: 0 },
  });

  const categoriesStatus = ref("success");
  const categoriesError = ref<Error | null>(null);

  const items = ref([
    {
      id: "note-1",
      title: "Example",
      preview: "Body",
      categoryId: "work",
      updatedAt: new Date().toISOString(),
    },
  ]);

  const listStatus = ref(initialListStatus);
  const listError = ref<Error | null>(null);
  fetchWorkspace.mockResolvedValueOnce({
    data: categories,
    status: categoriesStatus,
    error: categoriesError,
    refresh: vi.fn(),
  });
  fetchWorkspace.mockResolvedValueOnce({
    data: items,
    status: listStatus,
    error: listError,
    refresh: vi.fn(),
  });

  const wrapper = await mountSuspended(Workspace, {
    route,
    global: {
      stubs: {
        AppBrand: true,
        ThemePicker: true,
        ProfileMenu: true,
        CategoryNavigation: true,
        UModal: true,
        USlideover: true,
        UTooltip: { template: "<span><slot /></span>" },
        TypewriterText: {
          props: ["text"],
          template: "<span>{{ text }}</span>",
        },
      },
    },
  });

  return {
    wrapper,
    categories,
    categoriesStatus,
    categoriesError,
    items,
    listStatus,
    listError,
  };
}

it("shows loading until the first list request succeeds", async () => {
  const { wrapper, listStatus } = await mountWorkspace("/notes", "pending");
  expect(wrapper.find('[role="status"]').exists()).toBe(true);
  expect(wrapper.find(".content-list-item").exists()).toBe(false);

  listStatus.value = "success";
  await flushPromises();
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(wrapper.find(".content-list-item").exists()).toBe(true);
});

it("keeps list nodes and scroll position during refreshes of the same query", async () => {
  const { wrapper, items, listStatus } = await mountWorkspace("/chats");
  const list = wrapper.get(".list-scroll").element;
  const link = wrapper.get(".content-list-item").element;
  list.scrollTop = 180;

  listStatus.value = "pending";
  await flushPromises();
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(wrapper.get(".content-list-item").element).toBe(link);
  expect(list.scrollTop).toBe(180);

  items.value = [{ ...items.value[0]!, title: "Updated title" }];
  listStatus.value = "success";
  await flushPromises();
  expect(wrapper.get(".content-list-item").element).toBe(link);
  expect(wrapper.text()).toContain("Updated title");
  expect(list.scrollTop).toBe(180);
});

it.each(["/chats?category=work", "/notes?category=all"])(
  "hides stale items when changing the list context to %s",
  async (destination) => {
    const { wrapper, listStatus } = await mountWorkspace();
    listStatus.value = "pending";
    await useRouter().push(destination);
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.find(".content-list-item").exists()).toBe(false);
  },
);

it("hides stale results while a different search is loading", async () => {
  const { wrapper, listStatus } = await mountWorkspace();
  await wrapper.get("input").setValue("missing");
  listStatus.value = "pending";

  await expect.poll(() => wrapper.find('[role="status"]').exists()).toBe(true);
  expect(wrapper.find(".content-list-item").exists()).toBe(false);
});

it("replaces a deleted category without changing the open note or other query parameters", async () => {
  const content = document.createElement("div");
  content.id = "content";
  document.body.appendChild(content);

  const { categories, wrapper } = await mountWorkspace(
    "/notes/note-1?category=work&extra=keep#content",
  );

  categories.value = { ...categories.value, items: [] };
  await flushPromises();

  await expect
    .poll(() => useRouter().currentRoute.value.query.category)
    .toBe("uncategorized");

  const route = useRouter().currentRoute.value;
  expect(route.path).toBe("/notes/note-1");
  expect(route.query).toEqual({ category: "uncategorized", extra: "keep" });
  expect(route.hash).toBe("#content");
  expect(wrapper.get("h1").text()).toBe("Uncategorized");
});

it("waits for successful category retrieval before replacing a missing category", async () => {
  const { categories, categoriesStatus } = await mountWorkspace();
  categories.value = { ...categories.value, items: [] };
  categoriesStatus.value = "error";
  await flushPromises();
  expect(useRouter().currentRoute.value.query.category).toBe("work");

  categoriesStatus.value = "success";
  await expect
    .poll(() => useRouter().currentRoute.value.query.category)
    .toBe("uncategorized");
});

it("defers replacing a deleted category until editing ends", async () => {
  const { categories } = await mountWorkspace("/notes/note-1?category=work");

  const workspace =
    useState<ReturnType<typeof useWorkspace>["state"]["value"]>("workspace");

  workspace.value.editor = { active: true, dirty: true, busy: false };
  categories.value = { ...categories.value, items: [] };
  await flushPromises();
  expect(useRouter().currentRoute.value.query.category).toBe("work");
  expect(workspace.value.editor.dirty).toBe(true);

  workspace.value.editor = { active: false, dirty: false, busy: false };
  await expect
    .poll(() => useRouter().currentRoute.value.query.category)
    .toBe("uncategorized");
});

it.each([undefined, "other", "work"])(
  "refreshes data and switches the deleted filter after saving (deleted: %s)",
  async (deletedCategoryId) => {
    const { wrapper } = await mountWorkspace("/notes/note-1?category=work");
    wrapper.getComponent(CategoryNavigation).vm.$emit("delete", "work", "Work");
    await flushPromises();
    const dialog = wrapper.getComponent(WorkspaceCategoryDialog);
    expect(dialog.props("open")).toBe(true);
    expect(dialog.props("operation")).toBe("delete");
    expect(dialog.props("categoryId")).toBe("work");
    expect(dialog.props("name")).toBe("Work");

    await dialog.props("onSaved")(deletedCategoryId);
    await flushPromises();
    expect(refreshWorkspace).toHaveBeenCalledExactlyOnceWith();
    expect(useRouter().currentRoute.value.path).toBe("/notes/note-1");
    expect(useRouter().currentRoute.value.query.category).toBe(
      deletedCategoryId === "work" ? "uncategorized" : "work",
    );
  },
);

it("reports a rejected refresh after a category has been saved", async () => {
  const { wrapper } = await mountWorkspace();
  const refreshFailure = new Error("Refresh failed");
  refreshWorkspace.mockRejectedValueOnce(refreshFailure);
  const dialog = wrapper.getComponent(WorkspaceCategoryDialog);
  await expect(dialog.props("onSaved")()).rejects.toBe(refreshFailure);
});

it.each(["listError", "categoriesError"] as const)(
  "reports a failed %s even when refresh resolves",
  async (errorKey) => {
    const result = await mountWorkspace();
    refreshWorkspace.mockImplementationOnce(async () => {
      result[errorKey].value = new Error("Request failed");
    });
    const dialog = result.wrapper.getComponent(WorkspaceCategoryDialog);
    await expect(dialog.props("onSaved")()).rejects.toThrow(
      "Could not refresh the workspace",
    );
  },
);

it("reports cancelled navigation after deletion without changing the selected filter", async () => {
  const { wrapper } = await mountWorkspace("/notes/note-1?category=work");

  const workspace =
    useState<ReturnType<typeof useWorkspace>["state"]["value"]>("workspace");

  const removeGuard = useRouter().beforeEach(
    (to) => to.query.category !== "uncategorized",
  );

  try {
    const dialog = wrapper.getComponent(WorkspaceCategoryDialog);
    await expect(dialog.props("onSaved")("work")).rejects.toBeInstanceOf(Error);
    expect(useRouter().currentRoute.value.query.category).toBe("work");
    expect(workspace.value.filter).toBe("work");
  } finally {
    removeGuard();
  }
});

it("does not open the category dialog while the editor is saving", async () => {
  const { wrapper } = await mountWorkspace("/notes/note-1?category=work");

  const workspace =
    useState<ReturnType<typeof useWorkspace>["state"]["value"]>("workspace");

  workspace.value.editor = { active: true, dirty: true, busy: true };
  wrapper.getComponent(CategoryNavigation).vm.$emit("create");
  await flushPromises();
  expect(wrapper.getComponent(WorkspaceCategoryDialog).props("open")).toBe(
    false,
  );
});

it("does not open the category dialog if leaving an edited note is cancelled", async () => {
  const { wrapper } = await mountWorkspace("/notes/note-1?category=work");

  const workspace =
    useState<ReturnType<typeof useWorkspace>["state"]["value"]>("workspace");

  workspace.value.editor = { active: true, dirty: true, busy: false };
  const removeGuard = useRouter().beforeEach((to) => to.path !== "/notes");

  try {
    wrapper.getComponent(CategoryNavigation).vm.$emit("rename", "work", "Work");
    await flushPromises();
    expect(useRouter().currentRoute.value.path).toBe("/notes/note-1");
    expect(wrapper.getComponent(WorkspaceCategoryDialog).props("open")).toBe(
      false,
    );
    expect(workspace.value.editor.dirty).toBe(true);
  } finally {
    removeGuard();
  }
});
