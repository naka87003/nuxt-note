import { afterEach, vi } from "vitest";
import { enableAutoUnmount } from "@vue/test-utils";

enableAutoUnmount((unmount) => {
  afterEach(() => {
    // Keep mocked browser APIs available to component cleanup hooks.
    try {
      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
