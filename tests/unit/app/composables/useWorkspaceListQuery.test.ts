import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useWorkspaceListQuery } from "../../../../app/composables/useWorkspaceListQuery";

let scope: ReturnType<typeof effectScope>;

beforeEach(() => {
  vi.useFakeTimers();
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
});

function setup(initialSearch = "") {
  const mode = ref("notes");
  const category = ref("all");
  const search = ref(initialSearch);
  const query = scope.run(() => useWorkspaceListQuery(mode, category, search))!;
  return { mode, category, search, query };
}

it("preserves the initial search and waits 500ms after the last input", async () => {
  const { search, query } = setup("saved");
  expect(query.value).toEqual({ category: "all", q: "saved" });
  search.value = "n";
  await nextTick();
  await vi.advanceTimersByTimeAsync(400);
  search.value = "nuxt";
  await nextTick();
  await vi.advanceTimersByTimeAsync(499);
  expect(query.value.q).toBe("saved");
  await vi.advanceTimersByTimeAsync(1);
  expect(query.value.q).toBe("nuxt");
});

it("clears immediately and cancels pending input", async () => {
  const { search, query } = setup("saved");
  search.value = "pending";
  await nextTick();
  search.value = "";
  await nextTick();
  expect(query.value.q).toBe("");
  const clearedQuery = query.value;
  await vi.advanceTimersByTimeAsync(500);
  expect(query.value).toBe(clearedQuery);
});

it("applies pending input immediately when changing categories", async () => {
  const { category, search, query } = setup();
  search.value = "nuxt";
  await nextTick();
  category.value = "work";
  await nextTick();
  expect(query.value).toEqual({ category: "work", q: "nuxt" });
  const categoryQuery = query.value;
  await vi.advanceTimersByTimeAsync(500);
  expect(query.value).toBe(categoryQuery);
});

it("uses the destination search immediately when switching modes", async () => {
  const { mode, search, query } = setup();
  search.value = "pending note search";
  await nextTick();
  mode.value = "chats";
  search.value = "saved chat search";
  await nextTick();
  expect(query.value.q).toBe("saved chat search");
  const chatQuery = query.value;
  await vi.advanceTimersByTimeAsync(500);
  expect(query.value).toBe(chatQuery);
});

it("cancels pending input when disposed", async () => {
  const { search, query } = setup();
  search.value = "pending";
  await nextTick();
  scope.stop();
  await vi.advanceTimersByTimeAsync(500);
  expect(query.value.q).toBe("");
});
