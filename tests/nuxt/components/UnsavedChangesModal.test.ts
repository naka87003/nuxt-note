import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { useNuxtApp } from "#imports";
import UnsavedChangesModal from "~/components/UnsavedChangesModal.vue";

beforeEach(() => useNuxtApp().$unsavedChanges.resolve(false));

describe("UnsavedChangesModal", () => {
  it.each([
    ["Keep editing", false],
    ["Discard changes", true],
  ] as const)("resolves %s as %s", async (label, expected) => {
    const wrapper = await mountSuspended(UnsavedChangesModal, {
      global: {
        stubs: {
          UModal: {
            props: ["open"],
            template: '<div v-if="open"><slot name="footer" /></div>',
          },
        },
      },
    });
    const confirmation = useNuxtApp().$unsavedChanges;
    const decision = confirmation.confirm();
    await flushPromises();
    const button = wrapper
      .findAll("button")
      .find((item) => item.text() === label)!;
    await button.trigger("click");
    await expect(decision).resolves.toBe(expected);
    expect(confirmation.open.value).toBe(false);
  });

  it("keeps editing when the modal is dismissed", async () => {
    const wrapper = await mountSuspended(UnsavedChangesModal, {
      global: { stubs: { UModal: true } },
    });
    const confirmation = useNuxtApp().$unsavedChanges;
    const decision = confirmation.confirm();
    await flushPromises();
    wrapper.getComponent({ name: "UModal" }).vm.$emit("update:open", false);
    await expect(decision).resolves.toBe(false);
    expect(confirmation.open.value).toBe(false);
  });
});
