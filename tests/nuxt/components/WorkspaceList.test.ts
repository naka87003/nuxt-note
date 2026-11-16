import { mockComponent, mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, nextTick } from "vue";
import { renderToString } from "vue/server-renderer";
import {
  clearNuxtState,
  useNuxtApp,
  useRouter,
  useUserSession,
} from "#imports";
import WorkspaceList from "~/components/WorkspaceList.vue";

mockComponent("UTooltip", { template: "<span><slot /></span>" });

const item = {
  id: "item-1",
  title: "Example",
  preview: "Body",
  categoryId: "work",
  updatedAt: "2026-11-07T00:00:00Z",
};

const baseProps = {
  items: [],
  heading: "All notes",
  loading: false,
  failed: false,
};

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
  useNuxtApp().$unsavedChanges.resolve(false);
});

const global = {
  stubs: {
    TypewriterText: { props: ["text"], template: "<span>{{ text }}</span>" },
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mountList(
  options: Parameters<typeof mountSuspended<typeof WorkspaceList>>[1],
) {
  return mountSuspended(WorkspaceList, { ...options, global });
}

describe("WorkspaceList", () => {
  it("server-renders the list controls and loading fallback without date groups or items", async () => {
    const nuxtApp = useNuxtApp();

    const app = createSSRApp(WorkspaceList, {
      ...baseProps,
      referenceDate: "2026-11-16T12:00:00",
      items: [{ ...item, updatedAt: "2026-11-16T06:00:00" }],
    });

    Object.assign(app._context.provides, nuxtApp.vueApp._context.provides);

    const html = await nuxtApp.runWithContext(() => renderToString(app));
    expect(html).toContain("All notes");
    expect(html).toContain("Search notes");
    expect(html).toContain('class="list-scroll"');
    expect(html).toContain("Loading…");
    expect(html).not.toContain("Today");
    expect(html).not.toContain("content-list-item");
    expect(html).not.toContain("Example");
  });

  it("updates calendar groups when returning after midnight without a reference date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T23:59:00"));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    const wrapper = await mountList({
      props: {
        ...baseProps,
        items: [
          { ...item, updatedAt: "2026-11-16T20:00:00" },
          { ...item, id: "earlier", updatedAt: "2026-11-08T12:00:00" },
        ],
      },
      route: "/notes",
    });

    expect(wrapper.findAll("h2").map((heading) => heading.text())).toEqual([
      "Today",
      "This Month",
    ]);

    vi.setSystemTime(new Date("2026-11-17T00:01:00"));
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    expect(wrapper.findAll("h2").map((heading) => heading.text())).toEqual([
      "Last 7 Days",
      "This Month",
    ]);
  });

  it("keeps the supplied reference date across mounts and visibility changes and reacts to prop updates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01T12:00:00"));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    const wrapper = await mountList({
      props: {
        ...baseProps,
        referenceDate: "2026-11-16T12:00:00",
        items: [{ ...item, updatedAt: "2026-11-16T06:00:00" }],
      },
      route: "/notes",
    });

    expect(wrapper.get("h2").text()).toBe("Today");
    expect(wrapper.get(".content-list-item").text()).not.toContain("2026");

    vi.setSystemTime(new Date("2041-01-01T12:00:00"));
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    expect(wrapper.get("h2").text()).toBe("Today");

    await wrapper.setProps({ referenceDate: "2026-11-17T12:00:00" });
    expect(wrapper.get("h2").text()).toBe("Last 7 Days");

    await wrapper.setProps({ referenceDate: "2028-11-16T12:00:00" });
    expect(wrapper.get("h2").text()).toBe("Older");
    expect(wrapper.get(".content-list-item").text()).toContain("2026");
  });

  it.each([
    ["chats", "notes"],
    ["notes", "chats"],
  ])("hides stale %s items while loading %s", async (from, to) => {
    const wrapper = await mountList({
      props: { ...baseProps, items: [item] },
      route: `/${from}`,
    });

    expect(wrapper.findAll(".content-list-item")).toHaveLength(1);

    await wrapper.setProps({ loading: true });
    await useRouter().push(`/${to}`);
    expect(wrapper.get('[role="status"]').text()).toBe("Loading…");
    expect(wrapper.get(".list-scroll").attributes("aria-busy")).toBe("true");
    expect(wrapper.findAll(".content-list-item")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Example");
    expect(wrapper.text()).not.toContain(`1 ${to}`);

    await wrapper.setProps({
      loading: false,
      items: [{ ...item, id: "loaded-item", title: "Loaded item" }],
    });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get(".list-scroll").attributes("aria-busy")).toBe("false");
    expect(wrapper.get(".content-list-item").attributes("href")).toContain(
      `/${to}/loaded-item`,
    );
  });

  it.each([
    [{ loading: true }, "Loading…"],
    [{ failed: true }, "Could not load your content"],
    [{}, "No notes here yet."],
  ] as const)("renders the empty-list state %j", async (props, text) => {
    const wrapper = await mountList({
      props: { ...baseProps, ...props },
      route: "/notes",
    });

    expect(wrapper.text()).toContain(text);

    if ("failed" in props && props.failed) {
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Try again")!
        .trigger("click");
      expect(wrapper.emitted("retry")).toHaveLength(1);
    }
  });

  it("updates search and distinguishes no results from an empty workspace", async () => {
    const wrapper = await mountList({ props: baseProps, route: "/notes" });
    await wrapper.get("input").setValue("missing");
    expect(wrapper.text()).toContain("No results found.");
    expect(wrapper.text()).not.toContain("No notes here yet.");
  });

  it.each(["notes", "chats"])(
    "builds %s item and creation links with the appropriate category",
    async (mode) => {
      const wrapper = await mountList({
        props: { ...baseProps, items: [item] },
        route: `/${mode}?category=all`,
      });

      const links = wrapper.findAll("a");
      expect(links.map((link) => link.attributes("href"))).toContain(
        `/${mode}/item-1?category=${mode === "notes" ? "all" : "work"}`,
      );
      expect(links.map((link) => link.attributes("href"))).toContain(
        `/${mode}/new?category=uncategorized`,
      );
      expect(wrapper.text()).toContain("Body");
    },
  );
});
