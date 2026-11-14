import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { clearNuxtState, useUserSession } from "#imports";
import NotePage from "~/pages/notes/[id].vue";

const fetchNote = vi.hoisted(() => vi.fn());
mockNuxtImport("useFetch", () => fetchNote);

beforeEach(() => {
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
