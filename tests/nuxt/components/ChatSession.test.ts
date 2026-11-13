import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { clearNuxtData, clearNuxtState } from "#imports";
import ChatSession from "~/components/ChatSession.vue";
import ChatComposer from "~/components/ChatComposer.vue";
import type { Conversation } from "~/composables/useChatGeneration";

const mocks = vi.hoisted(() => ({
  generation: vi.fn(),
  refresh: vi.fn(),
  request: vi.fn().mockResolvedValue(null),
}));
mockNuxtImport("$fetch", () => mocks.request);
mockNuxtImport("useChatGeneration", () => mocks.generation);
mockNuxtImport("useChatRefresh", () => mocks.refresh);

const reply = {
  id: "reply",
  role: "assistant" as const,
  content: "Answer",
  status: "completed",
  replyToId: "question",
  createdAt: "2026-11-07T00:00:00Z",
};
let conversation: Conversation;
let flow: {
  draft: ReturnType<typeof ref<string>>;
  persisted: ReturnType<typeof ref<boolean>>;
  busy: ReturnType<typeof ref<boolean>>;
  sending: ReturnType<typeof ref<boolean>>;
  waitingForResponse: ReturnType<typeof ref<boolean>>;
  failure: ReturnType<typeof ref<string>>;
  canRetry: ReturnType<typeof ref<boolean>>;
  lastReply: ReturnType<typeof ref<typeof reply | null>>;
  send: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
};
const request = mocks.request;
const modal = {
  name: "UModal",
  props: ["open", "title", "dismissible"],
  template:
    '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
};

beforeEach(() => {
  clearNuxtState();
  clearNuxtData();
  request
    .mockReset()
    .mockResolvedValue({ title: "Note", markdown: "Draft", categoryId: null });

  conversation = {
    id: "chat",
    title: "Conversation",
    generationId: null,
    messages: [reply],
  };
  flow = {
    draft: ref(""),
    persisted: ref(true),
    busy: ref(false),
    sending: ref(false),
    waitingForResponse: ref(false),
    failure: ref(""),
    canRetry: ref(false),
    lastReply: ref(reply),
    send: vi.fn(),
    generate: vi.fn(),
  };
  mocks.generation.mockReset().mockImplementation(() => flow);
  mocks.refresh.mockReset().mockImplementation(() => async () => conversation);
});

async function mountSession() {
  return await mountSuspended(ChatSession, {
    props: { chatId: "chat" },
    global: {
      stubs: {
        UModal: modal,
        TypewriterText: {
          props: ["text"],
          template: "<span>{{ text }}</span>",
        },
      },
    },
  });
}

describe("ChatSession", () => {
  it("prefills a new chat with a Note link and waits for the user's question", async () => {
    flow.persisted.value = false;
    mocks.refresh.mockImplementation(() => async () => null);
    const link = "https://example.com/notes/note-1\n\n";
    const wrapper = await mountSuspended(ChatSession, {
      props: { chatId: "", initialDraft: link },
    });
    expect(wrapper.get("textarea").element.value).toBe(link);
    expect(flow.send).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();

    await wrapper.get("textarea").setValue(`${link}要約してください`);
    await wrapper.get("form").trigger("submit");
    expect(flow.draft.value).toBe(`${link}要約してください`);
    expect(flow.send).toHaveBeenCalledTimes(1);
  });

  it("does not inject a Note link into an existing conversation", async () => {
    const wrapper = await mountSuspended(ChatSession, {
      props: { chatId: "chat", initialDraft: "/notes/note-1\n\n" },
    });
    expect(wrapper.get("textarea").element.value).toBe("");
    expect(flow.send).not.toHaveBeenCalled();
  });

  it("keeps following when asynchronous Markdown grows after the stream update", async () => {
    let notify!: ResizeObserverCallback;
    const observed = new Set<Element>();
    const observer = {
      observe: (element: Element) => observed.add(element),
      disconnect: () => observed.clear(),
      unobserve: (element: Element) => observed.delete(element),
    };
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (callback: ResizeObserverCallback) {
        notify = callback;
        return observer;
      }),
    );
    const wrapper = await mountSession();
    await flushPromises();
    const pane = wrapper.get(".chat-messages").element as HTMLElement;
    const content = pane.firstElementChild!;
    let height = 1000;
    let top = 0;
    Object.defineProperties(pane, {
      scrollHeight: { get: () => height, configurable: true },
      clientHeight: { get: () => 300, configurable: true },
      scrollTop: {
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, height - 300));
        },
        configurable: true,
      },
    });
    notify([], observer as ResizeObserver);
    expect(top).toBe(700);

    // A scroll event queued by the previous automatic scroll can arrive after
    // Comark has increased the content height. No user has scrolled upward.
    height = 1400;
    await wrapper.get(".chat-messages").trigger("scroll");
    expect(observed.has(content)).toBe(true);
    notify([], observer as ResizeObserver);
    await nextTick();
    expect(top).toBe(1100);
    expect(
      wrapper.find('[aria-label="Scroll to latest message"]').exists(),
    ).toBe(false);

    top = 800;
    await wrapper.get(".chat-messages").trigger("scroll");
    expect(
      wrapper.find('[aria-label="Scroll to latest message"]').exists(),
    ).toBe(true);
    height = 1800;
    notify([], observer as ResizeObserver);
    await nextTick();
    expect(top).toBe(800);

    await wrapper
      .get('[aria-label="Scroll to latest message"]')
      .trigger("click");
    expect(top).toBe(1500);
    height = 2000;
    notify([], observer as ResizeObserver);
    expect(top).toBe(1700);
  });

  it("connects the composer draft and send action to generation", async () => {
    const wrapper = await mountSession();
    await wrapper.get("textarea").setValue("Question");
    expect(flow.draft.value).toBe("Question");
    await wrapper.get("form").trigger("submit");
    expect(flow.send).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(wrapper.text()).toContain("Answer");
  });

  it("disables sending and chat actions while a response is generating", async () => {
    flow.busy.value = true;
    flow.sending.value = true;
    flow.waitingForResponse.value = true;
    const wrapper = await mountSession();
    expect(wrapper.getComponent(ChatComposer).props("busy")).toBe(true);
    expect(wrapper.get("textarea").attributes("disabled")).toBeDefined();
    for (const label of ["Generate draft", "Delete"]) {
      expect(
        wrapper
          .findAll("button")
          .find((button) => button.text() === label)!
          .attributes("disabled"),
      ).toBeDefined();
    }
    expect(wrapper.findComponent({ name: "ChatResponseCursor" }).exists()).toBe(
      true,
    );
  });

  it("shows generation errors and connects the retry button", async () => {
    flow.failure.value = "Connection interrupted";
    flow.canRetry.value = true;
    const wrapper = await mountSession();
    expect(wrapper.text()).toContain("Connection interrupted");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Try again")!
      .trigger("click");
    expect(flow.generate).toHaveBeenCalledTimes(1);
    flow.canRetry.value = false;
    flow.failure.value = "";
    await nextTick();
    expect(wrapper.text()).not.toContain("Try again");
  });

  it("requires confirmation before requesting an AI note", async () => {
    const wrapper = await mountSession();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Generate draft")!
      .trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Generate a draft from this chat?",
    );
    expect(request).not.toHaveBeenCalled();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Cancel")!
      .trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("prevents dismissing or submitting the note dialog again while generating", async () => {
    request.mockReturnValue(new Promise(() => {}));
    const wrapper = await mountSession();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Generate draft")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Generate")!
      .trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/api/chats/chat/note-draft",
      expect.objectContaining({ method: "POST" }),
    );
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Generating your draft…",
    );
    expect(wrapper.get('[role="dialog"]').findAll("button")).toHaveLength(0);
    expect(wrapper.getComponent({ name: "UModal" }).props("dismissible")).toBe(
      false,
    );
    expect(wrapper.getComponent(ChatComposer).props("disabled")).toBe(true);
  });
});
