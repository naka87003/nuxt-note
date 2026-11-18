import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { useUserSession } from "#imports";
import LandingPage from "~/pages/index.vue";

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }));
mockNuxtImport("navigateTo", () => navigateTo);

beforeEach(() => {
  navigateTo.mockReset().mockResolvedValue(undefined);
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

async function mountLanding() {
  return mountSuspended(LandingPage, {
    global: {
      stubs: {
        AppBrand: true,
        ThemePicker: true,
        LandingBackgroundDots: true,
        LandingBackgroundGradient: true,
        LandingAiIllustration: true,
        LandingNoteIllustration: true,
        LandingWorkspacePreview: true,
        LandingChatNotePreview: true,
        LandingMcpSection: true,
      },
    },
  });
}

it.each([0, 1, 2])(
  "keeps only notebook link %i spinning after routing resolves and disables all notebook links",
  async (index) => {
    const wrapper = await mountLanding();
    const links = wrapper.findAll('a[href="/notes"]');
    expect(links).toHaveLength(3);

    await links[index]!.trigger("click");
    await flushPromises();

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith("/notes");

    for (const [position, link] of links.entries()) {
      expect(link.find(".animate-spin").exists()).toBe(position === index);
      expect(link.attributes("aria-disabled")).toBe("true");
    }
  },
);

it("restores all notebook links after cancellation", async () => {
  navigateTo.mockResolvedValue(false);
  const wrapper = await mountLanding();

  await wrapper.get(".hero-actions a").trigger("click");
  await flushPromises();

  const links = wrapper.findAll('a[href="/notes"]');
  expect(links).toHaveLength(3);

  for (const link of links) {
    expect(link.find(".animate-spin").exists()).toBe(false);
    expect(link.attributes("aria-disabled")).toBeUndefined();
  }
});

it("preserves the normal sign-in link for signed-out visitors", async () => {
  useUserSession().session.value = {};
  const wrapper = await mountLanding();

  expect(wrapper.get(".sign-in").attributes("href")).toBe("/login");
  await wrapper.get(".sign-in").trigger("click");
  await flushPromises();
  expect(navigateTo).not.toHaveBeenCalled();
  expect(wrapper.get(".sign-in").find(".animate-spin").exists()).toBe(false);
});
