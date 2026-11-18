import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { useRouter, useUserSession } from "#imports";
import SettingsLayout from "~/layouts/settings.vue";

beforeEach(() => {
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

async function mountLayout() {
  return mountSuspended(SettingsLayout, {
    route: "/settings/agent-access",
    global: {
      stubs: { AppBrand: true, ThemePicker: true, ProfileMenu: true },
    },
  });
}

it("shows loading for Notes navigation and enables the link again after cancellation", async () => {
  const wrapper = await mountLayout();
  const back = wrapper.get('a[aria-label="Back to Notes"]');
  const router = useRouter();
  const { promise, resolve } = Promise.withResolvers<false>();
  const removeGuard = router.beforeEach(() => promise);

  try {
    await back.trigger("click");
    await vi.waitFor(() => {
      expect(back.find(".animate-spin").exists()).toBe(true);
      expect(back.attributes("aria-disabled")).toBe("true");
    });

    await flushPromises();
    expect(back.find(".animate-spin").exists()).toBe(true);

    resolve(false);
    await vi.waitFor(() => {
      expect(back.find(".animate-spin").exists()).toBe(false);
      expect(back.attributes("aria-disabled")).toBeUndefined();
      expect(back.attributes("href")).toBe("/notes");
    });
  } finally {
    resolve(false);
    removeGuard();
  }
});

it("does not show the Notes spinner when the logo starts navigation", async () => {
  const wrapper = await mountLayout();
  const back = wrapper.get('a[aria-label="Back to Notes"]');
  const { promise, resolve } = Promise.withResolvers<false>();
  const guard = vi.fn(() => promise);
  const removeGuard = useRouter().beforeEach(guard);

  const navigation = useRouter().push(
    wrapper.get('a[aria-label="Nuxt Note home"]').attributes("href")!,
  );

  try {
    await vi.waitFor(() => expect(guard).toHaveBeenCalled());
    expect(back.find(".animate-spin").exists()).toBe(false);
    expect(back.attributes("aria-disabled")).toBeUndefined();
    expect(back.attributes("href")).toBe("/notes");
  } finally {
    resolve(false);
    await navigation;
    removeGuard();
    await flushPromises();
  }
});

it("preserves the Notes link and native Cmd-click behavior", async () => {
  const wrapper = await mountLayout();
  const back = wrapper.get('a[aria-label="Back to Notes"]');
  const router = useRouter();
  const currentRoute = router.currentRoute.value;

  const event = new MouseEvent("click", {
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });

  expect(back.attributes("href")).toBe("/notes");
  back.element.dispatchEvent(event);
  await flushPromises();

  expect(event.defaultPrevented).toBe(false);
  expect(router.currentRoute.value).toBe(currentRoute);
  expect(back.find(".animate-spin").exists()).toBe(false);
  expect(back.attributes("href")).toBe("/notes");
});
