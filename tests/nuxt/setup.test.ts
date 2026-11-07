import { expect, it, vi } from "vitest";
import { onBeforeUnmount } from "vue";
import { mountComposable } from "./helpers/mount-composable";

it("keeps browser mocks available until automatic unmount completes", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await mountComposable(() => {
    onBeforeUnmount(() => {
      expect(globalThis.fetch).toBe(fetch);
    });
  });
});
