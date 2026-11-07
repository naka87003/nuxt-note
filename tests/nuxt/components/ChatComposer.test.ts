import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import ChatComposer from "~/components/ChatComposer.vue";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

describe("ChatComposer", () => {
  it("updates the draft and sends with Enter or the submit button", async () => {
    const wrapper = await mountSuspended(ChatComposer);
    const input = wrapper.get("textarea");
    await input.setValue("Hello");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["Hello"]);
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toHaveLength(1);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")).toHaveLength(2);
  });

  it.each([
    { shiftKey: true, isComposing: false },
    { shiftKey: false, isComposing: true },
  ])(
    "does not send on Shift+Enter or an IME confirmation: %j",
    async (event) => {
      const wrapper = await mountSuspended(ChatComposer, {
        props: { modelValue: "日本語" },
      });
      await wrapper
        .get("textarea")
        .trigger("keydown", { key: "Enter", ...event });
      expect(wrapper.emitted("send")).toBeUndefined();
    },
  );

  it.each([
    { modelValue: "   " },
    { modelValue: "Hello", busy: true },
    { modelValue: "Hello", disabled: true },
    { modelValue: "x".repeat(INPUT_LIMITS.chatMessage + 1) },
  ])("blocks invalid or unavailable submissions: %j", async (props) => {
    const wrapper = await mountSuspended(ChatComposer, { props });
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await wrapper.get("form").trigger("submit");
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toBeUndefined();
  });

  it("allows a draft at the character limit", async () => {
    const wrapper = await mountSuspended(ChatComposer, {
      props: { modelValue: "x".repeat(INPUT_LIMITS.chatMessage) },
    });
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")).toHaveLength(1);
  });
});
