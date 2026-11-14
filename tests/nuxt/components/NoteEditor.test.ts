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
import { defineComponent } from "vue";
import { INPUT_LIMITS } from "#shared/utils/input-limits";

import { useNoteEditor } from "~/composables/useNoteEditor";
import { mountComposable } from "../helpers/mount-composable";

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
  updatedAt: "2026-11-13T00:00:00.000Z",
  title: "Original",
  markdown: "Body",
  categoryId: null,
};

beforeEach(() => {
  request
    .mockReset()
    .mockResolvedValue({ id: "note-1", updatedAt: "2026-11-13T00:00:01.000Z" });
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
          retry: 0,
          body: {
            title: "Changed",
            markdown: "Changed body",
            categoryId: "work",
            ...(existing ? { updatedAt: savedNote.updatedAt } : {}),
          },
        },
      );
      expect(wrapper.emitted("saved")).toEqual([
        [
          {
            id: "note-1",
            updatedAt: "2026-11-13T00:00:01.000Z",
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

  it("allows changing a removed category and retrying a new Note without losing its draft", async () => {
    request.mockRejectedValueOnce({ statusCode: 404 });
    const wrapper = await mountSuspended(NoteEditor);
    await edit(wrapper);
    const form = wrapper.getComponent(NoteEditorForm);
    form.vm.$emit("update:category", "removed");
    form.vm.$emit("save");
    await flushPromises();
    expect(wrapper.text()).toContain(
      "selected category is no longer available",
    );
    expect(form.props("saveBlocked")).toBe(false);
    form.vm.$emit("update:category", "uncategorized");
    form.vm.$emit("save");
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
        updatedAt: "2026-11-13T00:00:02.000Z",
      },
    });
    const form = wrapper.getComponent(NoteEditorForm);
    expect(form.props("title")).toBe("Changed");
    expect(form.props("markdown")).toBe("Body");
    expect(form.props("dirty")).toBe(true);
    form.vm.$emit("save");
    await flushPromises();
    expect(request.mock.calls[0]![1].body.updatedAt).toBe(savedNote.updatedAt);
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

const modal = defineComponent({
  props: ["open", "title"],
  template:
    '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
});
const latestNote = {
  ...savedNote,
  title: "Remote title",
  markdown: "Remote body",
  updatedAt: "2026-11-13T00:00:02.000Z",
};
async function conflictEditor(prepareError?: unknown) {
  request.mockRejectedValueOnce({ statusCode: 409 });
  if (prepareError) request.mockRejectedValueOnce(prepareError);
  else request.mockResolvedValueOnce(latestNote);
  const wrapper = await mountSuspended(NoteEditor, {
    props: { note: savedNote },
    global: { stubs: { UModal: modal } },
  });
  await edit(wrapper);
  wrapper
    .getComponent(NoteEditorForm)
    .vm.$emit("update:markdown", "Local body");
  wrapper.getComponent(NoteEditorForm).vm.$emit("update:category", "work");
  await flushPromises();
  wrapper.getComponent(NoteEditorForm).vm.$emit("save");
  await flushPromises();
  return wrapper;
}
function action(
  wrapper: Awaited<ReturnType<typeof conflictEditor>>,
  label: string,
) {
  return wrapper.findAll("button").find((button) => button.text() === label)!;
}
describe("NoteEditor conflicts", () => {
  it("preserves the draft and requires an explicit confirmation without displaying either full Note", async () => {
    const wrapper = await conflictEditor();
    const form = wrapper.getComponent(NoteEditorForm);
    expect(form.props()).toMatchObject({
      title: "Changed",
      markdown: "Local body",
      category: "work",
      dirty: true,
      saveBlocked: false,
    });
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain("Overwrite this note?");
    expect(dialog.text()).not.toContain(latestNote.markdown);
    expect(dialog.text()).not.toContain("Local body");
    expect(dialog.findAll("button").map((button) => button.text())).toEqual([
      "Keep editing",
      "Overwrite and save",
    ]);
    form.vm.$emit("save");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("saved")).toBeUndefined();
    await action(wrapper, "Keep editing").trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(form.props("markdown")).toBe("Local body");
    expect(request).toHaveBeenCalledTimes(2);
    await edit(wrapper, "More local edits");
    const newVersion = "2026-11-13T00:00:03.000Z";
    request.mockResolvedValueOnce({ ...latestNote, updatedAt: newVersion });
    form.vm.$emit("save");
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith("/api/notes/note-1", { retry: 0 });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    request.mockResolvedValueOnce({
      id: "note-1",
      updatedAt: "2026-11-13T00:00:04.000Z",
    });
    await action(wrapper, "Overwrite and save").trigger("click");
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith("/api/notes/note-1", {
      method: "PATCH",
      retry: 0,
      body: {
        title: "More local edits",
        markdown: "Local body",
        categoryId: "work",
        updatedAt: newVersion,
      },
    });
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });
  it("requires a new confirmation when another update races an overwrite", async () => {
    const wrapper = await conflictEditor();
    const newerVersion = "2026-11-13T00:00:03.000Z";
    request
      .mockRejectedValueOnce({ statusCode: 409 })
      .mockResolvedValueOnce({ ...latestNote, updatedAt: newerVersion });
    await action(wrapper, "Overwrite and save").trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(4);
    expect(
      request.mock.calls.filter(([, options]) => options.method === "PATCH"),
    ).toHaveLength(2);
    expect(request.mock.calls[2]![1].body.updatedAt).toBe(latestNote.updatedAt);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.getComponent(NoteEditorForm).props("markdown")).toBe(
      "Local body",
    );
    request.mockResolvedValueOnce({
      id: "note-1",
      updatedAt: "2026-11-13T00:00:04.000Z",
    });
    await action(wrapper, "Overwrite and save").trigger("click");
    await flushPromises();
    expect(request.mock.calls.at(-1)![1].body.updatedAt).toBe(newerVersion);
  });
  it("preserves the draft when preparing confirmation fails and offers a manual retry", async () => {
    const wrapper = await conflictEditor(new Error("offline"));
    expect(wrapper.text()).toContain("Could not prepare overwrite");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.getComponent(NoteEditorForm).props("markdown")).toBe(
      "Local body",
    );
    request.mockResolvedValueOnce(latestNote);
    wrapper.getComponent(NoteEditorForm).vm.$emit("save");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(3);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(
      request.mock.calls.filter(([, options]) => options.method === "PATCH"),
    ).toHaveLength(1);
  });
  it("keeps the confirmation and draft after a failed overwrite, and blocks duplicate submissions", async () => {
    const wrapper = await conflictEditor();
    let reject!: (error: Error) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    await action(wrapper, "Overwrite and save").trigger("click");
    await flushPromises();
    expect(
      action(wrapper, "Keep editing").attributes("disabled"),
    ).toBeDefined();
    expect(
      action(wrapper, "Overwrite and save").attributes("disabled"),
    ).toBeDefined();
    await action(wrapper, "Overwrite and save").trigger("click");
    expect(request).toHaveBeenCalledTimes(3);
    reject(new Error("offline"));
    await flushPromises();
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Could not save your note",
    );
    expect(wrapper.getComponent(NoteEditorForm).props("markdown")).toBe(
      "Local body",
    );
    expect(wrapper.emitted("saved")).toBeUndefined();
  });
  it("preserves a deleted Note's draft and prevents further writes", async () => {
    const wrapper = await conflictEditor({ statusCode: 404 });
    expect(wrapper.text()).toContain("deleted or is no longer available");
    expect(wrapper.getComponent(NoteEditorForm).props()).toMatchObject({
      markdown: "Local body",
      saveBlocked: true,
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.getComponent(NoteEditorForm).vm.$emit("save");
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(2);
  });
});

it("keeps save success when the success callback throws instead of treating it as an API conflict", async () => {
  const callbackError = Object.assign(new Error("View failed"), {
    statusCode: 409,
  });
  const { result } = await mountComposable(() =>
    useNoteEditor({
      note: savedNote,
      categoryId: null,
      onSaved: () => {
        throw callbackError;
      },
    }),
  );
  await expect(result.save()).rejects.toBe(callbackError);
  expect(result.saved.value).toBe(true);
  expect(result.saving.value).toBe(false);
  expect(result.failure.value).toBe("");
  expect(result.confirmation.value).toBe(false);
  await result.save();
  expect(request).toHaveBeenCalledTimes(1);
});
