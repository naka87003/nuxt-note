import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import CopyableValue from "~/components/CopyableValue.vue";

it("renders arbitrary settings as text and copies the exact value", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const value = 'https://example.com/?value=<script>&text="hello"';
  const wrapper = await mountSuspended(CopyableValue, { props: { value } });
  expect(wrapper.get("code").element.textContent).toBe(value);
  expect(wrapper.find("script, pre").exists()).toBe(false);
  const button = wrapper.get('button[aria-label="Copy value"]');
  await button.trigger("click");
  await flushPromises();
  expect(writeText).toHaveBeenCalledWith(value);
  expect(button.attributes("data-state")).toBe("copied");
  await wrapper.setProps({ value: "Updated setting" });
  expect(button.attributes("data-state")).toBe("idle");
  expect(wrapper.get('[role="status"]').text()).toBe("");
});
