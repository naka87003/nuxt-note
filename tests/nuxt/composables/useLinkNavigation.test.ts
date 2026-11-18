import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useLinkNavigation } from "~/composables/useLinkNavigation";
import { mountComposable } from "../helpers/mount-composable";

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }));
mockNuxtImport("navigateTo", () => navigateTo);

beforeEach(() => {
  navigateTo.mockReset().mockResolvedValue(undefined);
});

function click(options: MouseEventInit = {}) {
  return new MouseEvent("click", { cancelable: true, ...options });
}

it("keeps the clicked source loading after routing resolves and prevents repeated navigation", async () => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  navigateTo.mockReturnValue(promise);
  const { result } = await mountComposable(() => useLinkNavigation("/notes"));
  const event = click();
  const navigation = result.navigate(event, "hero");

  expect(event.defaultPrevented).toBe(true);
  expect(result.opening.value).toBe("hero");
  expect(result.pending.value).toBe(true);
  const repeatedClick = click();
  await result.navigate(repeatedClick, "header");
  expect(repeatedClick.defaultPrevented).toBe(true);
  expect(result.opening.value).toBe("hero");
  expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/notes");

  resolve(undefined);
  await navigation;
  expect(result.opening.value).toBe("hero");
  expect(result.pending.value).toBe(true);
});

it("resets on cancellation and reads the latest destination when retried", async () => {
  navigateTo.mockResolvedValueOnce(false);
  const destination = ref("/notes");

  const { result } = await mountComposable(() =>
    useLinkNavigation(destination),
  );

  await result.navigate(click(), "hero");
  expect(result.opening.value).toBeNull();
  expect(result.pending.value).toBe(false);

  destination.value = "/login";
  await result.navigate(click(), "header");
  expect(navigateTo).toHaveBeenLastCalledWith("/login");
  expect(result.opening.value).toBe("header");
});

it("resets after a rejected navigation and allows a retry", async () => {
  const failure = new Error("Navigation failed");
  navigateTo.mockRejectedValueOnce(failure);
  const { result } = await mountComposable(() => useLinkNavigation("/notes"));

  await expect(result.navigate(click())).rejects.toBe(failure);
  expect(result.pending.value).toBe(false);
  expect(result.opening.value).toBeNull();
  await result.navigate(click());
  expect(navigateTo).toHaveBeenCalledTimes(2);
  expect(result.pending.value).toBe(true);
});

it.each([
  { button: 1 },
  { button: 2 },
  { ctrlKey: true },
  { metaKey: true },
  { shiftKey: true },
  { altKey: true },
])("leaves native link handling intact for %j", async (options) => {
  const { result } = await mountComposable(() => useLinkNavigation("/notes"));
  const event = click(options);

  await result.navigate(event);
  expect(event.defaultPrevented).toBe(false);
  expect(result.pending.value).toBe(false);
  expect(navigateTo).not.toHaveBeenCalled();
});

it("does not navigate when another handler has prevented the click", async () => {
  const { result } = await mountComposable(() => useLinkNavigation("/notes"));
  const event = click();
  event.preventDefault();

  await result.navigate(event);
  expect(result.pending.value).toBe(false);
  expect(navigateTo).not.toHaveBeenCalled();
});
