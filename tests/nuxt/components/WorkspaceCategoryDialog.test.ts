import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import WorkspaceCategoryDialog from "~/components/WorkspaceCategoryDialog.vue";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

const { request, addToast } = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue(null),
  addToast: vi.fn(),
}));

mockNuxtImport("$fetch", () => request);
mockNuxtImport("useToast", () => () => ({ add: addToast }));

beforeEach(() => {
  request.mockReset().mockResolvedValue(undefined);
  addToast.mockReset();
});

async function mountDialog(
  operation: "create" | "rename" | "delete" = "create",
) {
  const onSaved = vi.fn().mockResolvedValue(undefined);

  const wrapper = await mountSuspended(WorkspaceCategoryDialog, {
    props: { open: true, operation, categoryId: "work", name: "Work", onSaved },
    global: {
      stubs: {
        UModal: defineComponent({
          name: "UModal",
          props: ["open", "title", "dismissible", "close"],
          template:
            '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
        }),
      },
    },
  });

  return { wrapper, onSaved };
}

it.each([
  ["create", "/api/categories", "POST", "New category"],
  ["rename", "/api/categories/work", "PATCH", "Rename category"],
  ["delete", "/api/categories/work", "DELETE", "Delete category"],
] as const)(
  "submits %s and awaits the workspace update",
  async (operation, url, method, title) => {
    const { wrapper, onSaved } = await mountDialog(operation);
    expect(wrapper.get("h2").text()).toBe(title);

    if (operation !== "delete") {
      await wrapper.get("input").setValue("Updated");
    } else {
      expect(wrapper.text()).toContain("will become Uncategorized");
      expect(wrapper.find("input").exists()).toBe(false);
    }

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(request).toHaveBeenCalledExactlyOnceWith(url, {
      method,
      ...(operation === "delete" ? {} : { body: { name: "Updated" } }),
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(
      operation === "delete" ? "work" : undefined,
    );
  },
);

it("keeps request errors in the dialog and resets the form when reopened", async () => {
  const { wrapper, onSaved } = await mountDialog("rename");
  request.mockRejectedValueOnce({
    data: { statusMessage: "Name already exists" },
  });
  await wrapper.get("input").setValue("Duplicate");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe("Name already exists");
  expect(onSaved).not.toHaveBeenCalled();
  expect(addToast).not.toHaveBeenCalled();

  await wrapper.setProps({ open: false });
  await wrapper.setProps({ open: true, name: "Latest name" });
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.get("input").element.value).toBe("Latest name");
});

it("blocks duplicate submissions and dismissal until saving finishes", async () => {
  const { wrapper, onSaved } = await mountDialog();
  const save = Promise.withResolvers<undefined>();
  request.mockReturnValueOnce(save.promise);
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  await wrapper.get("form").trigger("submit");
  expect(request).toHaveBeenCalledTimes(1);
  expect(wrapper.getComponent({ name: "UModal" }).props("dismissible")).toBe(
    false,
  );
  expect(wrapper.getComponent({ name: "UModal" }).props("close")).toBe(false);

  const cancel = wrapper
    .findAll("button")
    .find((button) => button.text() === "Cancel")!;

  expect(cancel.attributes("disabled")).toBeDefined();

  save.resolve(undefined);
  await flushPromises();
  expect(wrapper.emitted("update:open")).toEqual([[false]]);
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(onSaved).toHaveBeenCalledOnce();
});

it.each(["create", "rename", "delete"] as const)(
  "warns that %s succeeded if the subsequent view update fails",
  async (operation) => {
    const { wrapper, onSaved } = await mountDialog(operation);
    onSaved.mockRejectedValueOnce(new Error("Refresh failed"));
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(request).toHaveBeenCalledOnce();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(addToast).toHaveBeenCalledExactlyOnceWith({
      title: operation === "delete" ? "Category deleted" : "Category saved",
      description:
        "The change was saved, but the view could not be refreshed. Reload to see the latest content.",
      color: "warning",
      icon: "i-lucide-triangle-alert",
    });
  },
);

it("validates name length and disables empty names", async () => {
  const { wrapper } = await mountDialog();
  await wrapper.get("input").setValue(" ");
  expect(
    wrapper.get('button[type="submit"]').attributes("disabled"),
  ).toBeDefined();
  await wrapper
    .get("input")
    .setValue("a".repeat(INPUT_LIMITS.categoryName + 1));
  await wrapper.get("form").trigger("submit");
  expect(request).not.toHaveBeenCalled();
  expect(wrapper.get('[role="alert"]').text()).toContain(
    `at most ${INPUT_LIMITS.categoryName}`,
  );
});
