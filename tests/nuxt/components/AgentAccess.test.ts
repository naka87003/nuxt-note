import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import AgentAccess from "~/pages/settings/agent-access.vue";

const { request, refresh } = vi.hoisted(() => ({
  request: vi.fn(),
  refresh: vi.fn(),
}));
mockNuxtImport("$fetch", () => request);
mockNuxtImport("useFetch", () => () => ({
  data: ref([]),
  status: ref("success"),
  error: ref(null),
  refresh,
}));

const token = `nnr_${"a".repeat(43)}`;
beforeEach(() => {
  request.mockReset().mockResolvedValue({ id: "token-id", token });
  refresh.mockReset().mockResolvedValue(undefined);
});

describe("Agent access token display", () => {
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
