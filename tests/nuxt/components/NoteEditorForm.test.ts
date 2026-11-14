import { mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import NoteEditorForm from "~/components/NoteEditorForm.vue";

const baseProps = {
  title: "Title",
  markdown: "Body",
  category: "uncategorized",
  categoryOptions: [
    { label: "Uncategorized", value: "uncategorized" },
    { label: "Work", value: "work" },
  ],
  dirty: true,
};
let media: MediaQueryList;
beforeEach(() => {
  media = Object.assign(new EventTarget(), {
    matches: false,
    media: "(max-width: 767px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: EventTarget.prototype.dispatchEvent,
  }) as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
});

describe("NoteEditorForm", () => {
  it("preserves the server's initial tabs before applying the mobile viewport", async () => {
    Object.assign(media, { matches: true });
    let initialTabs: string[] = [];
    const wrapper = await mountSuspended(NoteEditorForm, {
      props: baseProps,
      global: {
        stubs: {
          UTabs: defineComponent({
            props: { items: { type: Array, required: true } },
            setup(props) {
              initialTabs = (props.items as { label: string }[]).map(
                (item) => item.label,
              );
              return () => h("div");
            },
          }),
        },
      },
    });
    expect(initialTabs).toEqual(["Edit", "Split view", "Preview"]);
    expect(wrapper.get(".note-editor-panes").attributes("data-view")).toBe(
      "edit",
    );
  });

  it.each([
    { saving: true },
    { saved: true },
    { overLimit: true },
    { saveBlocked: true },
    { note: true, dirty: false },
  ])("prevents saving while unavailable: %j", async (props) => {
    const wrapper = await mountSuspended(NoteEditorForm, {
      props: { ...baseProps, ...props },
    });
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("emits save and cancel when available", async () => {
    const wrapper = await mountSuspended(NoteEditorForm, { props: baseProps });
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")).toHaveLength(1);
    await wrapper.get('button[type="button"]').trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("updates title, body and category models", async () => {
    const wrapper = await mountSuspended(NoteEditorForm, { props: baseProps });
    await wrapper.get("input").setValue("Changed title");
    await wrapper.get("textarea").setValue("Changed body");
    // Select's public event verifies the form's category model binding.
    const select = wrapper.findComponent({ name: "USelect" });
    select.vm.$emit("update:modelValue", "work");
    await nextTick();
    expect(wrapper.emitted("update:title")?.at(-1)).toEqual(["Changed title"]);
    expect(wrapper.emitted("update:markdown")?.at(-1)).toEqual([
      "Changed body",
    ]);
    expect(wrapper.emitted("update:category")?.at(-1)).toEqual(["work"]);
  });

  it("switches views and preserves content and the desktop split choice on resize", async () => {
    const wrapper = await mountSuspended(NoteEditorForm, { props: baseProps });
    const pane = wrapper.get(".note-editor-panes");
    expect(pane.attributes("data-view")).toBe("split");
    Object.assign(media, { matches: true });
    media.dispatchEvent(
      new MediaQueryListEvent("change", {
        matches: media.matches,
        media: media.media,
      }),
    );
    await nextTick();
    expect(pane.attributes("data-view")).toBe("edit");
    expect(
      wrapper.findAll('[role="tab"]').map((tab) => tab.text()),
    ).not.toContain("Split view");
    Object.assign(media, { matches: false });
    media.dispatchEvent(
      new MediaQueryListEvent("change", {
        matches: media.matches,
        media: media.media,
      }),
    );
    await nextTick();
    expect(pane.attributes("data-view")).toBe("split");
    const preview = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === "Preview")!;
    await preview.trigger("mousedown", { button: 0, ctrlKey: false });
    expect(pane.attributes("data-view")).toBe("preview");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Body",
    );
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "Title",
    );
  });

  it("shows save failures and limit guidance without clearing content", async () => {
    const wrapper = await mountSuspended(NoteEditorForm, {
      props: { ...baseProps, failure: "Try again", overLimit: true },
    });
    expect(wrapper.text()).toContain("Try again");
    expect(wrapper.text()).toContain("This note exceeds the character limit");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Body",
    );
  });
});
