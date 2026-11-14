import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { clearNuxtState, useUserSession } from "#imports";
import NotePage from "~/pages/notes/[id].vue";
import NewNotePage from "~/pages/notes/new.vue";
import NoteEditor from "~/components/NoteEditor.vue";

const { fetchNote, request, navigate, refreshWorkspace, addToast } = vi.hoisted(
  () => ({
    fetchNote: vi.fn(),
    request: vi.fn(),
    navigate: vi.fn(),
    refreshWorkspace: vi.fn(),
    addToast: vi.fn(),
  }),
);
mockNuxtImport("useToast", () => () => ({ add: addToast }));
mockNuxtImport("$fetch", () => request);
mockNuxtImport("navigateTo", () => navigate);
mockNuxtImport("refreshNuxtData", () => refreshWorkspace);
mockNuxtImport("useFetch", () => fetchNote);

beforeEach(() => {
  addToast.mockReset();
  request.mockReset().mockResolvedValue(undefined);
  navigate.mockReset().mockResolvedValue(undefined);
  refreshWorkspace.mockReset().mockResolvedValue(undefined);
  clearNuxtState();
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

it("shows loading before opening a note and keeps its content during background refreshes", async () => {
  const note = {
    id: "note-2",
    title: "Next note",
    markdown: "Body",
    categoryId: null as string | null,
    createdAt: "2026-11-13T00:00:00Z",
    updatedAt: "2026-11-13T00:00:00Z",
  };
  const data = ref<typeof note | null>(null);
  const status = ref("pending");
  fetchNote.mockResolvedValue({
    data,
    status,
    error: ref(null),
    refresh: vi.fn(),
  });
  const wrapper = await mountSuspended(NotePage, {
    route: "/notes/note-2",
    global: { stubs: { MarkdownContent: true } },
  });
  expect(wrapper.get('[role="status"]').text()).toBe("Loading…");
  expect(wrapper.find(".note-reader-actions").exists()).toBe(false);

  data.value = note;
  status.value = "success";
  await flushPromises();
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(wrapper.text()).toContain("Next note");
  expect(wrapper.find(".note-reader-actions").exists()).toBe(true);

  const article = wrapper.get("article").element;
  status.value = "pending";
  await flushPromises();
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(wrapper.get("article").element).toBe(article);
  expect(wrapper.text()).toContain("Next note");
});

it.each(["work", null])(
  "opens Ask AI with the saved Note and its category (%s), regardless of the list filter",
  async (categoryId) => {
    fetchNote.mockResolvedValue({
      data: ref({
        id: "note-1",
        title: "My note",
        markdown: "Saved body",
        categoryId,
        createdAt: "2026-11-13T00:00:00Z",
        updatedAt: "2026-11-13T00:00:00Z",
      }),
      error: ref(null),
      status: ref("success"),
      refresh: vi.fn(),
    });
    const wrapper = await mountSuspended(NotePage, {
      route: "/notes/note-1?category=all",
      global: { stubs: { MarkdownContent: true } },
    });
    const button = wrapper
      .findAll("a")
      .find((link) => link.text() === "Ask AI")!;
    expect(button).toBeDefined();
    const target = new URL(button.attributes("href")!, "https://example.com");
    expect(target.pathname).toBe("/chats/new");
    expect(target.searchParams.get("note")).toBe("note-1");
    expect(target.searchParams.get("category")).toBe(
      categoryId ?? "uncategorized",
    );
  },
);

const original = {
  id: "note-1",
  title: "Original",
  markdown: "Original body",
  categoryId: null,
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
};
const changed = {
  ...original,
  title: "Updated title",
  markdown: "Updated body",
  updatedAt: "2026-11-13T00:00:01.000Z",
};
async function deletionPage(route = "/notes/note-1") {
  const data = ref<typeof original | undefined>({ ...original });
  const error = ref<{ statusCode: number } | null>(null);
  const status = ref("success");
  const refresh = vi.fn().mockImplementation(async () => {
    data.value = { ...changed };
    error.value = null;
    status.value = "success";
  });
  fetchNote.mockResolvedValue({ data, error, refresh, status });
  const wrapper = await mountSuspended(NotePage, {
    route,
    global: {
      stubs: {
        MarkdownContent: {
          props: ["content"],
          template: "<div>{{ content }}</div>",
        },
        UModal: defineComponent({
          props: ["open", "title"],
          template:
            '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
        }),
      },
    },
  });
  return { wrapper, data, refresh, error, status };
}
function button(
  wrapper: Awaited<ReturnType<typeof deletionPage>>["wrapper"],
  label: string,
) {
  return wrapper.findAll("button").find((item) => item.text() === label)!;
}

it("stops stale deletion, shows the latest content, and requires a new confirmation", async () => {
  const { wrapper, refresh } = await deletionPage();
  await button(wrapper, "Delete").trigger("click");
  request.mockRejectedValueOnce({ statusCode: 409 });
  await button(wrapper, "Delete note").trigger("click");
  await flushPromises();
  expect(request).toHaveBeenCalledExactlyOnceWith("/api/notes/note-1", {
    method: "DELETE",
    retry: 0,
    body: { updatedAt: original.updatedAt },
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(wrapper.get("article").text()).toContain("Updated body");
  expect(wrapper.text()).toContain("was not deleted");
  await button(wrapper, "Delete").trigger("click");
  expect(wrapper.get('[role="dialog"]').text()).toContain("Updated title");
  expect(request).toHaveBeenCalledTimes(1);
  await button(wrapper, "Delete note").trigger("click");
  await flushPromises();
  expect(request.mock.calls[1]![1].body.updatedAt).toBe(changed.updatedAt);
  expect(navigate).toHaveBeenCalledOnce();
});

it("keeps the confirmed deletion version even if background data refreshes", async () => {
  const { wrapper, data } = await deletionPage();
  await button(wrapper, "Delete").trigger("click");
  data.value = { ...changed };
  await flushPromises();
  expect(wrapper.get('[role="dialog"]').text()).toContain("Original");
  request.mockRejectedValueOnce({ statusCode: 409 });
  await button(wrapper, "Delete note").trigger("click");
  await flushPromises();
  expect(request.mock.calls[0]![1].body.updatedAt).toBe(original.updatedAt);
  expect(navigate).not.toHaveBeenCalled();
});

it.each([404, 503])(
  "blocks deletion if the latest content cannot be loaded (%s)",
  async (statusCode) => {
    const { wrapper, refresh, error, data, status } = await deletionPage();
    refresh.mockImplementation(async () => {
      error.value = { statusCode };
      data.value = undefined;
      status.value = "error";
    });
    await button(wrapper, "Delete").trigger("click");
    request.mockRejectedValueOnce({ statusCode: 409 });
    await button(wrapper, "Delete note").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll("button")
        .some(
          (item) =>
            item.text() === "Delete" &&
            item.attributes("disabled") === undefined,
        ),
    ).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(
      statusCode === 404
        ? "no longer available"
        : "Could not load the latest version",
    );
    refresh.mockImplementation(async () => {
      data.value = { ...changed };
      error.value = null;
      status.value = "success";
    });
    await button(wrapper, "Load latest version").trigger("click");
    await flushPromises();
    expect(button(wrapper, "Delete").attributes("disabled")).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  },
);

it.each([
  "navigation",
  "cancelled navigation",
  "failed navigation result",
  "list refresh",
])("reports deletion success if %s fails afterwards", async (step) => {
  const { wrapper, data } = await deletionPage();
  if (step === "navigation")
    navigate.mockRejectedValueOnce(new Error("Navigation failed"));
  else if (step === "cancelled navigation")
    navigate.mockResolvedValueOnce(false);
  else if (step === "failed navigation result")
    navigate.mockResolvedValueOnce(new Error("Navigation failed"));
  else refreshWorkspace.mockRejectedValueOnce(new Error("List refresh failed"));
  await button(wrapper, "Delete").trigger("click");
  await button(wrapper, "Delete note").trigger("click");
  await flushPromises();
  expect(request).toHaveBeenCalledTimes(1);
  expect(data.value).toBeUndefined();
  expect(wrapper.text()).toContain("Note deleted");
  expect(wrapper.text()).toContain(
    "The note was deleted, but the view could not be refreshed",
  );
  expect(wrapper.text()).not.toContain("Could not delete");
  expect(wrapper.find("article").exists()).toBe(false);
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(wrapper.get("a[href='/notes?category=all']").text()).toBe(
    "Back to notes",
  );
  expect(request).toHaveBeenCalledTimes(1);
});
it.each([
  "navigation",
  "cancelled navigation",
  "failed navigation result",
  "note refresh",
  "list refresh",
])(
  "retains a saved Note and reports success if %s fails afterwards",
  async (step) => {
    const { wrapper, data, refresh, error, status } = await deletionPage();
    const savedNote = { ...changed, title: "Saved title", categoryId: "work" };
    if (step === "navigation")
      navigate.mockRejectedValueOnce(new Error("Navigation failed"));
    else if (step === "cancelled navigation")
      navigate.mockResolvedValueOnce(false);
    else if (step === "failed navigation result")
      navigate.mockResolvedValueOnce(new Error("Navigation failed"));
    else if (step === "note refresh")
      refresh.mockImplementationOnce(async () => {
        error.value = { statusCode: 503 };
        data.value = undefined;
        status.value = "error";
      });
    else
      refreshWorkspace.mockRejectedValueOnce(new Error("List refresh failed"));
    await button(wrapper, "Edit").trigger("click");
    wrapper.getComponent(NoteEditor).vm.$emit("saved", savedNote);
    await flushPromises();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Note saved", color: "warning" }),
    );
    expect(wrapper.findComponent(NoteEditor).exists()).toBe(false);
    if (step === "note refresh") {
      expect(data.value).toEqual(savedNote);
      expect(wrapper.get("article").text()).toContain("Saved title");
    }
    expect(data.value).toBeDefined();
    expect(wrapper.text()).not.toContain("Could not save");
    expect(request).not.toHaveBeenCalled();
  },
);
it.each([
  "navigation",
  "cancelled navigation",
  "failed navigation result",
  "list refresh",
])("offers the saved Note link after creation if %s fails", async (step) => {
  const wrapper = await mountSuspended(NewNotePage, {
    route: "/notes/new?category=work",
    global: {
      stubs: {
        NoteEditor: {
          name: "NoteEditor",
          emits: ["saved"],
          template: "<div />",
        },
      },
    },
  });
  if (step === "navigation")
    navigate.mockRejectedValueOnce(new Error("Navigation failed"));
  else if (step === "cancelled navigation")
    navigate.mockResolvedValueOnce(false);
  else if (step === "failed navigation result")
    navigate.mockResolvedValueOnce(new Error("Navigation failed"));
  else refreshWorkspace.mockRejectedValueOnce(new Error("List refresh failed"));
  wrapper
    .getComponent({ name: "NoteEditor" })
    .vm.$emit("saved", { ...original, categoryId: "work" });
  await flushPromises();
  expect(addToast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Note saved",
      actions: [
        {
          label: "Open note",
          to: { path: "/notes/note-1", query: { category: "work" } },
        },
      ],
    }),
  );
  expect(request).not.toHaveBeenCalled();
});

async function duplicatedNavigation() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/notes/:id", component: {} }],
  });
  await router.push("/notes/note-1?category=work");
  return router.replace("/notes/note-1?category=work");
}
it("refreshes a saved Note without warning when its category URL is already current", async () => {
  const { wrapper, refresh } = await deletionPage(
    "/notes/note-1?category=work",
  );
  navigate.mockResolvedValueOnce(await duplicatedNavigation());
  await button(wrapper, "Edit").trigger("click");
  wrapper
    .getComponent(NoteEditor)
    .vm.$emit("saved", { ...changed, categoryId: "work" });
  await flushPromises();
  expect(refresh).toHaveBeenCalledOnce();
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-list");
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-categories");
  expect(addToast).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
it("refreshes lists after a duplicate navigation when opening a newly saved Note", async () => {
  const wrapper = await mountSuspended(NewNotePage, {
    route: "/notes/new?category=work",
    global: {
      stubs: {
        NoteEditor: {
          name: "NoteEditor",
          emits: ["saved"],
          template: "<div />",
        },
      },
    },
  });
  navigate.mockResolvedValueOnce(await duplicatedNavigation());
  wrapper
    .getComponent({ name: "NoteEditor" })
    .vm.$emit("saved", { ...original, categoryId: "work" });
  await flushPromises();
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-list");
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-categories");
  expect(addToast).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
it("does not report a post-deletion view error for duplicate navigation", async () => {
  const { wrapper } = await deletionPage();
  navigate.mockResolvedValueOnce(await duplicatedNavigation());
  await button(wrapper, "Delete").trigger("click");
  await button(wrapper, "Delete note").trigger("click");
  await flushPromises();
  expect(request).toHaveBeenCalledTimes(1);
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-list");
  expect(refreshWorkspace).toHaveBeenCalledWith("workspace-categories");
  expect(wrapper.text()).not.toContain("could not be refreshed");
});
