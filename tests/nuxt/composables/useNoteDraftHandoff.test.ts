import { beforeEach, expect, it, vi } from "vitest";
import { useNoteDraftHandoff } from "~/composables/useNoteDraftHandoff";

import {
  clearNuxtState,
  useNuxtApp,
  useRouter,
  useUserSession,
} from "#imports";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const navigate = vi.hoisted(() => vi.fn());
mockNuxtImport("navigateTo", () => navigate);
async function createHandoff() {
  return await useNuxtApp().runWithContext(() => useNoteDraftHandoff());
}
const transfer = {
  draft: { title: "AI draft", markdown: "# Summary", categoryId: "nuxt" },
  returnTo: { path: "/chats/source", query: { category: "nuxt" } },
};

beforeEach(async () => {
  clearNuxtState(["chat-note-transfer", "note-draft-return"]);
  navigate.mockReset();
  useUserSession().session.value = {
    id: "test-session",
    user: {
      id: "owner",
      githubLogin: "fixture",
      name: "Fixture",
      avatarUrl: "",
    },
  };
  await useRouter().push("/notes/new");
});

it("delivers a generated draft once, without seeding later new notes", async () => {
  const handoff = await createHandoff();
  navigate.mockImplementation(async () => {
    const editor = await createHandoff();
    expect(editor.consume()).toEqual(transfer);
    expect(editor.consume()).toBeNull();
  });
  await handoff.open(transfer);
  expect(handoff.consume()).toBeNull();
  expect(navigate).toHaveBeenCalledWith({
    path: "/notes/new",
    query: { category: "nuxt" },
  });
});

it.each([false, new Error("navigation failed")])(
  "clears pending draft after an unsuccessful navigation result %s",
  async (result) => {
    const handoff = await createHandoff();
    navigate.mockResolvedValue(result);
    await expect(handoff.open(transfer)).rejects.toThrow();
    // An ordinary New note opened afterward must start blank.
    expect((await createHandoff()).consume()).toBeNull();
  },
);

it("clears pending draft when navigation rejects", async () => {
  const handoff = await createHandoff();
  navigate.mockRejectedValue(new Error("route error"));
  await expect(handoff.open(transfer)).rejects.toThrow("route error");
  expect(handoff.consume()).toBeNull();
});

it("allows the destination to consume the draft after navigation resolves", async () => {
  const handoff = await createHandoff();
  navigate.mockResolvedValue(undefined);
  await handoff.open(transfer);
  expect(handoff.consume()).toEqual(transfer);
  expect(handoff.consume()).toBeNull();
});

it("clears pending content if authentication redirects away from the editor", async () => {
  const handoff = await createHandoff();
  navigate.mockImplementation(async () => {
    await useRouter().push("/login");
  });
  await expect(handoff.open(transfer)).rejects.toThrow();
  expect(handoff.consume()).toBeNull();
});

it("does not remove a newer draft when an older navigation fails late", async () => {
  let failFirst!: (error: Error) => void;
  let finishSecond!: () => void;
  navigate
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        failFirst = reject;
      }),
    )
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSecond = resolve;
      }),
    );
  const handoff = await createHandoff();
  const first = handoff.open(transfer);
  const check = expect(first).rejects.toThrow("old failure");
  const newer = {
    ...transfer,
    draft: { ...transfer.draft, title: "Newer draft" },
  };
  const second = handoff.open(newer);
  failFirst(new Error("old failure"));
  await check;
  expect(handoff.consume()).toEqual(newer);
  finishSecond();
  await second;
});

it("uses Uncategorized for an uncategorized draft", async () => {
  const handoff = await createHandoff();
  navigate.mockResolvedValue(undefined);
  await handoff.open({
    ...transfer,
    draft: { ...transfer.draft, categoryId: null },
  });
  expect(navigate).toHaveBeenCalledWith({
    path: "/notes/new",
    query: { category: "uncategorized" },
  });
});
