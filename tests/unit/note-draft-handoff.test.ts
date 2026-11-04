import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import { useNoteDraftHandoff } from "../../app/composables/useNoteDraftHandoff";

const navigate = vi.fn();
const states = new Map<string, ReturnType<typeof ref>>();
const route = ref({ path: "/notes/new" });
const transfer = {
  draft: { title: "AI draft", markdown: "# Summary", categoryId: "nuxt" },
  returnTo: { path: "/chats/source", query: { category: "nuxt" } },
};

beforeEach(() => {
  states.clear();
  vi.resetAllMocks();
  route.value = { path: "/notes/new" };
  vi.stubGlobal("useRouter", () => ({ currentRoute: route }));
  vi.stubGlobal("useState", (key: string, initial: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initial()));
    return states.get(key);
  });
  vi.stubGlobal("navigateTo", navigate);
});

it("delivers a generated draft once, without seeding later new notes", async () => {
  const handoff = useNoteDraftHandoff();
  navigate.mockImplementation(async () => {
    const editor = useNoteDraftHandoff();
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
    const handoff = useNoteDraftHandoff();
    navigate.mockResolvedValue(result);
    await expect(handoff.open(transfer)).rejects.toThrow();
    // An ordinary New note opened afterward must start blank.
    expect(useNoteDraftHandoff().consume()).toBeNull();
  },
);

it("clears pending draft when navigation rejects", async () => {
  const handoff = useNoteDraftHandoff();
  navigate.mockRejectedValue(new Error("route error"));
  await expect(handoff.open(transfer)).rejects.toThrow("route error");
  expect(handoff.consume()).toBeNull();
});

it("allows the destination to consume the draft after navigation resolves", async () => {
  const handoff = useNoteDraftHandoff();
  navigate.mockResolvedValue(undefined);
  await handoff.open(transfer);
  expect(handoff.consume()).toEqual(transfer);
  expect(handoff.consume()).toBeNull();
});

it("clears pending content if authentication redirects away from the editor", async () => {
  const handoff = useNoteDraftHandoff();
  navigate.mockImplementation(async () => {
    route.value = { path: "/login" };
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
  const handoff = useNoteDraftHandoff();
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
  const handoff = useNoteDraftHandoff();
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
