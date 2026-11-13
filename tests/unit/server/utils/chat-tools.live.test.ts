import { expect, it, vi } from "vitest";
import { createOpenAI } from "@ai-sdk/openai";
import { config as loadEnv } from "dotenv";
import { generateText, stepCountIs } from "ai";
import {
  CHAT_NOTES_INSTRUCTIONS,
  CHAT_TOOL_STEPS,
  createChatNoteTools,
} from "../../../../server/utils/chat-tools";

// Explicit opt-in. Uses real AI with fake Notes; never contacts the database.
// NUXT_NOTE_LIVE_AI=1 pnpm test --project unit tests/unit/server/utils/chat-tools.live.test.ts
const storage = vi.hoisted(() => ({
  readOwnedNote: vi.fn(),
  searchOwnedNotes: vi.fn(),
  createOwnedNote: vi.fn(),
  updateOwnedNote: vi.fn(),
  deleteOwnedNote: vi.fn(),
}));
vi.mock("../../../../server/utils/note-reads", () => storage);
vi.mock("../../../../server/utils/note-writes", () => storage);

it.skipIf(process.env.NUXT_NOTE_LIVE_AI !== "1")(
  "uses a created Note link to edit through the real model, despite an earlier incorrect refusal",
  async () => {
    loadEnv({ quiet: true });
    const apiKey = process.env.NUXT_OPENAI_API_KEY;
    if (!apiKey)
      throw new Error("NUXT_OPENAI_API_KEY is required for the live AI check.");
    const note = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Nuxt memo",
      markdown: "# Nuxt\nNuxt is a web framework.",
      updatedAt: new Date("2026-11-13T00:00:00.000Z"),
    };
    storage.readOwnedNote.mockImplementation(async (_owner, id) => {
      if (id !== note.id) throw { statusCode: 404 };
      return note;
    });
    storage.searchOwnedNotes.mockResolvedValue({
      notes: [note],
      nextOffset: null,
    });
    storage.updateOwnedNote.mockImplementation(async (_owner, input) => ({
      ...note,
      ...input,
      updatedAt: new Date("2026-11-13T00:00:01.000Z"),
    }));
    const url = `https://notes.example/notes/${note.id}`;
    const result = await generateText({
      model: createOpenAI({ apiKey })(
        process.env.NUXT_OPENAI_MODEL || "gpt-6.1-sol",
      ),
      system: CHAT_NOTES_INSTRUCTIONS,
      tools: createChatNoteTools("fake-owner", "https://notes.example", {
        signal: new AbortController().signal,
        assertActive: async () => {},
        allowMutations: true,
      }),
      messages: [
        { role: "user", content: "Nuxtについてノートを保存してください。" },
        { role: "assistant", content: `[Nuxt memo](${url}) に保存しました。` },
        { role: "user", content: "このノートにSSRの説明を追記してください。" },
        {
          role: "assistant",
          content:
            "このチャットからリンク先のNoteを直接編集することはできません。",
        },
        {
          role: "user",
          content:
            "先ほど作成したノートに、SSRはサーバーでHTMLを生成する方式、という説明を追記してください。実際にノートを更新してください。",
        },
      ],
      stopWhen: stepCountIs(CHAT_TOOL_STEPS),
      maxRetries: 0,
      maxOutputTokens: 2048,
      providerOptions: { openai: { store: false, parallelToolCalls: false } },
    });
    expect(storage.readOwnedNote).toHaveBeenCalledWith("fake-owner", note.id);
    expect(storage.updateOwnedNote).toHaveBeenCalledOnce();
    expect(storage.updateOwnedNote.mock.calls[0]![1]).toMatchObject({
      id: note.id,
      updatedAt: note.updatedAt.toISOString(),
      markdown: expect.stringContaining("SSR"),
    });
    expect(storage.createOwnedNote).not.toHaveBeenCalled();
    expect(storage.deleteOwnedNote).not.toHaveBeenCalled();
    expect(result.text).toContain(url);
  },
  120_000,
);
