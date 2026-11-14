import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { clearNuxtData, useFetch } from "#imports";
import { useWorkspaceListQuery } from "~/composables/useWorkspaceListQuery";
import { mountComposable } from "../helpers/mount-composable";

afterEach(() => {
  vi.useRealTimers();
  clearNuxtData("workspace-query-test");
});

it("debounces useFetch requests and switches endpoints with a fixed key", async () => {
  const mode = ref("notes");
  const category = ref("all");
  const search = ref("");
  const requests: { url: string; category: string; q: string }[] = [];
  const request = vi.fn(async (url, options) => {
    requests.push({ url, ...options.query });
    return [];
  });
  const { unmount } = await mountComposable(() => {
    const query = useWorkspaceListQuery(mode, category, search);
    return useFetch(() => `/api/${mode.value}`, {
      key: "workspace-query-test",
      query,
      $fetch: request as unknown as typeof $fetch,
    });
  });
  await flushPromises();
  expect(requests).toEqual([{ url: "/api/notes", category: "all", q: "" }]);
  vi.useFakeTimers();

  search.value = "n";
  await nextTick();
  await vi.advanceTimersByTimeAsync(400);
  search.value = "nuxt";
  await nextTick();
  await vi.advanceTimersByTimeAsync(499);
  expect(requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  await flushPromises();
  expect(requests.at(-1)).toEqual({
    url: "/api/notes",
    category: "all",
    q: "nuxt",
  });
  expect(requests).toHaveLength(2);

  // Identical query values must still fetch the destination mode's endpoint.
  mode.value = "chats";
  await nextTick();
  await flushPromises();
  expect(requests.at(-1)).toEqual({
    url: "/api/chats",
    category: "all",
    q: "nuxt",
  });
  expect(requests).toHaveLength(3);
  unmount();
});
