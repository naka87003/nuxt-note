import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNuxtData,
  clearNuxtState,
  useNuxtApp,
  useUserSession,
} from "#imports";
import NoteEditor from "~/components/NoteEditor.vue";
import NoteEditorForm from "~/components/NoteEditorForm.vue";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

const { request, leave, update } = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue(null),
  leave: vi.fn(),
  update: vi.fn(),
}));
mockNuxtImport("$fetch", () => request);
mockNuxtImport("onBeforeRouteLeave", () => leave);
mockNuxtImport("onBeforeRouteUpdate", () => update);
const savedNote = {
  id: "note-1",
  title: "Original",
  markdown: "Body",
  categoryId: null,
};

beforeEach(() => {
  request.mockReset().mockResolvedValue({ id: "note-1" });
  leave.mockReset();
  update.mockReset();
  useNuxtApp().$unsavedChanges.resolve(false);
  clearNuxtState();
  clearNuxtData();
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

async function edit(
  wrapper: Awaited<ReturnType<typeof mountSuspended<typeof NoteEditor>>>,
  title = "Changed",
) {
  wrapper.getComponent(NoteEditorForm).vm.$emit("update:title", title);
  await flushPromises();
}

describe("NoteEditor", () => {
  it.each([false, true])(
    "saves a %s existing note with the correct API and category",
    async (existing) => {
      const wrapper = await mountSuspended(NoteEditor, {
        props: existing ? { note: savedNote } : {},
      });
      await edit(wrapper);
      const form = wrapper.getComponent(NoteEditorForm);
      form.vm.$emit("update:markdown", "Changed body");
      form.vm.$emit("update:category", "work");
      await flushPromises();
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(request).toHaveBeenCalledWith(
        existing ? "/api/notes/note-1" : "/api/notes",
        {
          method: existing ? "PATCH" : "POST",
          body: {
            title: "Changed",
            markdown: "Changed body",
            categoryId: "work",
          },
        },
      );
      expect(wrapper.emitted("saved")).toEqual([
        [
          {
            id: "note-1",
            title: "Changed",
            markdown: "Changed body",
            categoryId: "work",
          },
        ],
      ]);
    },
  );

  it("blocks duplicate saves and further submissions after success", async () => {
    let resolve!: (value: { id: string }) => void;
    request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = await mountSuspended(NoteEditor);
    await edit(wrapper);
    const form = wrapper.getComponent(NoteEditorForm);
    form.vm.$emit("save");
    form.vm.$emit("save");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
    expect(form.props("saving")).toBe(true);
    resolve({ id: "note-1" });
    await flushPromises();
    form.vm.$emit("save");
    expect(request).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("preserves edits on failure and allows a manual retry", async () => {
    request.mockRejectedValueOnce(new Error("offline"));
    const wrapper = await mountSuspended(NoteEditor, {
      props: { note: savedNote },
    });
    await edit(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const form = wrapper.getComponent(NoteEditorForm);
    expect(form.props("title")).toBe("Changed");
    expect(form.props("markdown")).toBe("Body");
    expect(form.props("dirty")).toBe(true);
    expect(wrapper.text()).toContain("Could not save your note");
    expect(wrapper.emitted("saved")).toBeUndefined();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("does not replace a local draft when the saved note refreshes", async () => {
    const wrapper = await mountSuspended(NoteEditor, {
      props: { note: savedNote },
    });
    await edit(wrapper);
    await wrapper.setProps({
      note: {
        ...savedNote,
        title: "Background update",
        markdown: "Remote body",
      },
    });
    const form = wrapper.getComponent(NoteEditorForm);
    expect(form.props("title")).toBe("Changed");
    expect(form.props("markdown")).toBe("Body");
    expect(form.props("dirty")).toBe(true);
  });

  it("protects unsaved edits when cancelling until discard is confirmed", async () => {
    const wrapper = await mountSuspended(NoteEditor, {
      props: { note: savedNote },
    });
    await edit(wrapper);
    const confirmation = useNuxtApp().$unsavedChanges;
    wrapper.getComponent(NoteEditorForm).vm.$emit("cancel");
    await flushPromises();
    expect(confirmation.open.value).toBe(true);
    confirmation.resolve(false);
    await flushPromises();
    expect(wrapper.emitted("cancel")).toBeUndefined();
    expect(wrapper.getComponent(NoteEditorForm).props("dirty")).toBe(true);
    wrapper.getComponent(NoteEditorForm).vm.$emit("cancel");
    await flushPromises();
    confirmation.resolve(true);
    await flushPromises();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("asks for confirmation through the registered route leave guard", async () => {
    const wrapper = await mountSuspended(NoteEditor, {
      props: { note: savedNote },
    });
    const canLeave = leave.mock.calls[0]![0] as () => Promise<boolean>;
    await expect(canLeave()).resolves.toBe(true);
    await edit(wrapper);
    const decision = canLeave();
    expect(useNuxtApp().$unsavedChanges.open.value).toBe(true);
    useNuxtApp().$unsavedChanges.resolve(false);
    await expect(decision).resolves.toBe(false);
    const canUpdate = update.mock.calls[0]![0] as (
      to: { fullPath: string },
      from: { fullPath: string },
    ) => Promise<boolean> | undefined;
    expect(
      canUpdate({ fullPath: "/notes/note-1" }, { fullPath: "/notes/note-1" }),
    ).toBeUndefined();
    const updateDecision = canUpdate(
      { fullPath: "/notes/note-2" },
      { fullPath: "/notes/note-1" },
    );
    useNuxtApp().$unsavedChanges.resolve(true);
    await expect(updateDecision).resolves.toBe(true);
  });

  it("warns on closing the browser with edits and removes its listener on unmount", async () => {
    const wrapper = await mountSuspended(NoteEditor, {
      props: { note: savedNote },
    });
    await edit(wrapper);
    const before = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    wrapper.unmount();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("retains an oversized imported draft and prevents API calls", async () => {
    const markdown = "x".repeat(INPUT_LIMITS.noteBody + 1);
    const wrapper = await mountSuspended(NoteEditor, {
      props: {
        initialDraft: { title: "Imported", markdown, categoryId: null },
      },
    });
    const form = wrapper.getComponent(NoteEditorForm);
    expect(form.props("overLimit")).toBe(true);
    expect(form.props("markdown")).toBe(markdown);
    form.vm.$emit("save");
    await flushPromises();
    expect(request).not.toHaveBeenCalled();
  });
});
