import { mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearNuxtState,
  useNuxtApp,
  useRouter,
  useUserSession,
} from "#imports";
import WorkspaceList from "~/components/WorkspaceList.vue";

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
    UTooltip: { template: "<span><slot /></span>" },
    TypewriterText: { props: ["text"], template: "<span>{{ text }}</span>" },
  },
};
function mountList(
  options: Parameters<typeof mountSuspended<typeof WorkspaceList>>[1],
) {
  return mountSuspended(WorkspaceList, { ...options, global });
}

describe("WorkspaceList", () => {
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
