import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import AgentAccess from "~/pages/settings/agent-access.vue";

const { request, refresh, tokens } = vi.hoisted(() => ({
  request: vi.fn(),
  refresh: vi.fn(),
  tokens: [] as { id: string; name: string; createdAt: string }[],
}));
mockNuxtImport("$fetch", () => request);
mockNuxtImport("useFetch", () => () => ({
  data: ref(tokens),
  status: ref("success"),
  error: ref(null),
  refresh,
}));

const token = `nnr_${"a".repeat(43)}`;
beforeEach(() => {
  tokens.length = 0;
  request.mockReset().mockResolvedValue({ id: "token-id", token });
  refresh.mockReset().mockResolvedValue(undefined);
});

describe("Agent access token display", () => {
  it("shows deletion errors inside the dialog and clears them when reopened", async () => {
    tokens.push({
      id: "token-id",
      name: "Codex",
      createdAt: "2026-11-13T00:00:00Z",
    });
    const wrapper = await mountSuspended(AgentAccess, {
      global: {
        stubs: {
          UModal: defineComponent({
            props: ["open", "title"],
            template:
              '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
          }),
        },
      },
    });
    await wrapper.get('button[aria-label="Delete Codex"]').trigger("click");
    expect(wrapper.get('[role="dialog"] h2').text()).toBe(
      "Delete token “Codex”?",
    );
    let rejectDelete!: (error: Error) => void;
    request.mockImplementationOnce(
      () => new Promise((_, reject) => (rejectDelete = reject)),
    );
    const confirm = () =>
      wrapper
        .get('[role="dialog"]')
        .findAll("button")
        .find((button) => button.text() === "Delete token")!;
    await confirm().trigger("click");
    const createButton = wrapper.get('button[type="submit"]');
    expect(createButton.attributes("disabled")).toBeDefined();
    expect(createButton.find(".animate-spin").exists()).toBe(false);
    expect(confirm().find(".animate-spin").exists()).toBe(true);
    rejectDelete(new Error("Unavailable"));
    await flushPromises();
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe(
      "Could not delete the token. Please try again.",
    );
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
    await wrapper
      .get('[role="dialog"]')
      .findAll("button")
      .find((button) => button.text() === "Cancel")!
      .trigger("click");
    await wrapper.get('button[aria-label="Delete Codex"]').trigger("click");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await confirm().trigger("click");
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith("/api/agent-tokens/token-id", {
      method: "DELETE",
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("explains compatibility and permits repeated value copying until hidden", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = await mountSuspended(AgentAccess);
    expect(wrapper.text()).toContain(
      "Only agents that support Streamable HTTP and manually configured Bearer tokens can connect.",
    );
    expect(wrapper.text()).not.toContain("Download Codex config");
    const endpoint = wrapper.get(".copyable-value code").text();
    await wrapper.get('button[aria-label="Copy URL"]').trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenLastCalledWith(endpoint);
    expect(wrapper.text()).toContain("URL copied to clipboard.");
    writeText.mockClear();
    expect(wrapper.find('button[aria-label="Copy token"]').exists()).toBe(
      false,
    );
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain(token);
    expect(wrapper.text()).toContain(
      "You can copy it as many times as needed while it is visible.",
    );
    const copy = wrapper.get('button[aria-label="Copy token"]');
    expect(copy.classes()).toContain("value-copy");
    for (let i = 0; i < 2; i++) {
      await copy.trigger("click");
      await flushPromises();
      expect(copy.attributes("data-state")).toBe("copied");
    }
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith(token);
    expect(wrapper.text()).toContain("Token copied to clipboard.");
    const hide = wrapper
      .findAll("button")
      .find((button) => button.text() === "Hide token")!;
    await hide.trigger("click");
    expect(wrapper.find('button[aria-label="Copy token"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain(token);
  });

  it("allows a retry after a failed token copy", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = await mountSuspended(AgentAccess);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const copy = wrapper.get('button[aria-label="Copy token"]');
    await copy.trigger("click");
    await flushPromises();
    expect(copy.attributes("data-state")).toBe("failed");
    expect(wrapper.text()).toContain(token);
    writeText.mockResolvedValue(undefined);
    await copy.trigger("click");
    await flushPromises();
    expect(copy.attributes("data-state")).toBe("copied");
    expect(writeText).toHaveBeenLastCalledWith(token);
  });
});
