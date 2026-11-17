import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref, type Ref } from "vue";
import {
  clearNuxtData,
  clearNuxtState,
  refreshNuxtData,
  useNuxtData,
  useError,
  useRouter,
  useUserSession,
} from "#imports";
import ChatSession from "~/components/ChatSession.vue";
import ChatComposer from "~/components/ChatComposer.vue";
import MarkdownContent from "~/components/MarkdownContent.vue";
import type { ChatMessage, Conversation } from "#shared/types/chat";

import type { CategoriesResponse } from "#shared/types/workspace";

const mocks = vi.hoisted(() => ({
  generation: vi.fn(),
  refresh: vi.fn(),
  request: vi.fn().mockResolvedValue(null),
  // Nuxt's session initialization also uses this fetch mock.
  readRequest: vi.fn().mockResolvedValue(null),
}));

mockNuxtImport("$fetch", () => mocks.request);
mockNuxtImport("useChatGeneration", () => mocks.generation);
mockNuxtImport("useChatRefresh", () => mocks.refresh);
mockNuxtImport("useRequestFetch", () => () => mocks.readRequest);

const reply: ChatMessage = {
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
  canStop: ReturnType<typeof ref<boolean>>;
  stopping: ReturnType<typeof ref<boolean>>;
  showProgressLabel: ReturnType<typeof ref<boolean>>;
  progressLabel: ReturnType<typeof ref<string>>;
  failure: ReturnType<typeof ref<string>>;
  canRetry: ReturnType<typeof ref<boolean>>;
  lastReply: ReturnType<typeof ref<typeof reply | null>>;
  send: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

const request = mocks.request;

const modal = {
  name: "UModal",
  props: ["open", "title", "dismissible"],
  template:
    '<section v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="body"/><slot name="footer"/></section>',
};

beforeEach(() => {
  expect(useError().value).toBeUndefined();
  clearNuxtState();
  clearNuxtData();
  mocks.readRequest.mockReset().mockResolvedValue(null);
  request
    .mockReset()
    .mockResolvedValue({ title: "Note", markdown: "Draft", categoryId: null });

  conversation = {
    id: "chat",
    title: "Conversation",
    generationId: null,
    messages: [{ ...reply }],
  };
  flow = {
    draft: ref(""),
    persisted: ref(true),
    busy: ref(false),
    sending: ref(false),
    canStop: ref(false),
    stopping: ref(false),
    showProgressLabel: ref(false),
    progressLabel: ref("Searching notes…"),
    failure: ref(""),
    canRetry: ref(false),
    lastReply: ref(reply),
    send: vi.fn(),
    generate: vi.fn(),
    stop: vi.fn(),
  };
  mocks.generation.mockReset().mockImplementation(() => flow);
  mocks.refresh.mockReset().mockImplementation((chat) => async () => {
    chat.value = conversation;

    return conversation;
  });
});

async function mountSession(route?: string) {
  return await mountSuspended(ChatSession, {
    props: { chatId: "chat" },
    ...(route ? { route } : {}),
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
  it("bounds stop confirmation requests to ten seconds without automatic retries", async () => {
    await mountSession();
    flow.stopping.value = true;
    mocks.readRequest.mockResolvedValue(conversation);
    const load = mocks.refresh.mock.calls[0]![3];
    await load("chat");
    expect(mocks.readRequest).toHaveBeenCalledWith("/api/chats/chat", {
      timeout: 10_000,
      retry: 0,
    });
  });

  it("keeps normal chat reads unchanged outside stop confirmation", async () => {
    await mountSession();
    mocks.readRequest.mockResolvedValue(conversation);
    const load = mocks.refresh.mock.calls[0]![3];
    await load("chat");
    expect(mocks.readRequest).toHaveBeenCalledWith(
      "/api/chats/chat",
      undefined,
    );
  });

  it("shows a generating response only after its text arrives", async () => {
    conversation.messages = [{ ...reply, content: "", status: "generating" }];
    flow.showProgressLabel.value = true;
    const wrapper = await mountSession();
    const chat: Ref<Conversation> = mocks.refresh.mock.calls[0]![0];
    expect(wrapper.find(".chat-assistant-message").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "ChatProgressLabel" }).exists()).toBe(
      true,
    );

    chat.value.messages[0]!.content = " \n";
    await nextTick();
    expect(wrapper.find(".chat-assistant-message").exists()).toBe(false);
    chat.value.messages[0]!.content = "Answer";
    await flushPromises();
    expect(wrapper.get(".chat-assistant-message").text()).toContain("Answer");
  });

  it.each([
    ["failed", "Could not complete the response."],
    ["stopped", "Response stopped."],
  ] as const)(
    "shows the error for an empty %s response",
    async (status, message) => {
      conversation.messages = [{ ...reply, content: "", status }];
      const wrapper = await mountSession();
      expect(wrapper.get(".chat-assistant-message").text()).toContain(message);
    },
  );

  it("passes the streaming state to Markdown until generation completes", async () => {
    conversation.messages = [{ ...reply, status: "generating" }];
    const wrapper = await mountSession();
    expect(wrapper.getComponent(MarkdownContent).props("streaming")).toBe(true);

    const chat: Ref<Conversation> = mocks.refresh.mock.calls[0]![0];
    chat.value.messages = [{ ...reply, status: "completed" }];
    await nextTick();
    expect(wrapper.getComponent(MarkdownContent).props("streaming")).toBe(
      false,
    );
  });

  it("keeps the conversation and draft mounted during a background refresh", async () => {
    const { promise, resolve } = Promise.withResolvers<Conversation>();

    const load = vi
      .fn()
      .mockImplementationOnce(async () => conversation)
      .mockReturnValue(promise);

    mocks.refresh.mockImplementation((chat) => async () => {
      const result = await load();
      chat.value = result;

      return result;
    });
    const wrapper = await mountSession();
    await wrapper.get("textarea").setValue("Unsent question");
    const textarea = wrapper.get("textarea").element;
    const refreshing = refreshNuxtData();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get("textarea").element).toBe(textarea);
    expect(wrapper.text()).toContain("Answer");
    resolve(conversation);
    await refreshing;
    expect(wrapper.get("textarea").element.value).toBe("Unsent question");
  });

  it("shows loading instead of the conversation and composer until the request completes", async () => {
    const { promise, resolve } = Promise.withResolvers<Conversation>();
    mocks.refresh.mockImplementation((chat) => async () => {
      const result = await promise;
      chat.value = result;

      return result;
    });
    const wrapper = await mountSession();
    expect(wrapper.get('[role="status"]').text()).toBe("Loading…");
    expect(wrapper.find(".chat-session").exists()).toBe(false);
    expect(wrapper.find("textarea").exists()).toBe(false);

    resolve(conversation);
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Answer");
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

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
    const pane = wrapper.get(".chat-messages").element;
    const content = wrapper.get(".chat-inner").element;
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
    notify([], observer);
    expect(top).toBe(700);

    height = 1200;
    flow.showProgressLabel.value = true;
    await flushPromises();
    expect(top).toBe(900);

    // A scroll event queued by the previous automatic scroll can arrive after
    // Comark has increased the content height. No user has scrolled upward.
    height = 1400;
    await wrapper.get(".chat-messages").trigger("scroll");
    expect(observed.has(content)).toBe(true);
    notify([], observer);
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
    notify([], observer);
    await nextTick();
    expect(top).toBe(800);

    flow.showProgressLabel.value = false;
    await flushPromises();
    expect(top).toBe(800);
    expect(wrapper.text()).not.toContain("New messages");
    flow.showProgressLabel.value = true;
    flow.progressLabel.value = "Reading a note…";
    await flushPromises();
    expect(top).toBe(800);
    expect(wrapper.text()).not.toContain("New messages");

    const chat: Ref<Conversation> = mocks.refresh.mock.calls[0]![0];
    chat.value.messages.push({
      ...reply,
      id: "empty-reply",
      content: "",
      status: "generating",
    });
    await flushPromises();
    expect(top).toBe(800);
    expect(wrapper.text()).not.toContain("New messages");
    chat.value = {
      ...chat.value,
      messages: chat.value.messages.map((message) => ({ ...message })),
    };
    await flushPromises();
    expect(top).toBe(800);
    expect(wrapper.text()).not.toContain("New messages");

    chat.value.messages[0]!.content += " More text.";
    await flushPromises();
    expect(top).toBe(800);
    expect(wrapper.text()).toContain("New messages");
    flow.showProgressLabel.value = false;
    await flushPromises();
    expect(wrapper.text()).toContain("New messages");

    await wrapper
      .get('[aria-label="Scroll to latest message"]')
      .trigger("click");
    expect(top).toBe(1500);
    expect(wrapper.text()).not.toContain("New messages");
    height = 2000;
    notify([], observer);
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
    flow.showProgressLabel.value = true;
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

    expect(wrapper.findComponent({ name: "ChatProgressLabel" }).exists()).toBe(
      true,
    );
    expect(wrapper.get('[role="status"]').text()).toContain("Searching notes…");
    expect(wrapper.find(".chat-cursor").exists()).toBe(false);
    flow.progressLabel.value = "Reading a note…";
    await nextTick();
    expect(wrapper.get('[role="status"]').text()).toContain("Reading a note…");
    flow.showProgressLabel.value = false;
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it("connects the stop button while chat actions and sending are disabled", async () => {
    flow.busy.value = true;
    flow.sending.value = true;
    flow.canStop.value = true;
    const wrapper = await mountSession();
    await wrapper.get('[aria-label="Stop response"]').trigger("click");
    expect(flow.stop).toHaveBeenCalledTimes(1);
    expect(flow.send).not.toHaveBeenCalled();

    flow.canStop.value = false;
    flow.stopping.value = true;
    await nextTick();
    expect(
      wrapper.get('[aria-label="Stop response"]').attributes("disabled"),
    ).toBeDefined();
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

async function categorySession() {
  useUserSession().session.value = {
    id: "test-session",
    user: {
      id: "owner",
      githubLogin: "fixture",
      name: "Fixture",
      avatarUrl: "",
    },
  };

  const categories = useNuxtData<CategoriesResponse>(
    "workspace-categories",
  ).data;

  categories.value = {
    items: [{ id: "work", name: "Work", _count: { notes: 0, chats: 1 } }],
    totals: { notes: 0, chats: 1 },
    uncategorized: { notes: 0, chats: 0 },
  };
  conversation.categoryId = "work";

  const load = vi
    .fn()
    .mockResolvedValueOnce(conversation)
    .mockResolvedValue({
      ...conversation,
      categoryId: null,
      messages: [{ ...reply }],
    });

  let chat!: Ref<Conversation | null>;
  mocks.refresh.mockImplementation((current) => {
    chat = current;

    return async () => {
      const snapshot = await load();
      current.value = snapshot;

      return snapshot;
    };
  });
  const wrapper = await mountSession("/chats/chat?category=work");
  await flushPromises();

  return { wrapper, categories, load, chat };
}

function withoutWorkCategory(categories: Ref<CategoriesResponse | undefined>) {
  categories.value = {
    ...categories.value!,
    items: [],
    uncategorized: { notes: 0, chats: 1 },
  };
}

describe("Chat category synchronization", () => {
  it.each([null, "target"])(
    "reflects a streamed Category change in the label and URL without reloading messages: %s",
    async (categoryId) => {
      const { wrapper, categories, load, chat } = await categorySession();

      if (!categories.value || !chat.value) {
        throw new Error("Missing fixture data");
      }

      categories.value = {
        ...categories.value,
        items: [
          ...categories.value.items,
          {
            id: "target",
            name: "Target",
            _count: { notes: 0, chats: 0 },
          },
        ],
      };
      await wrapper.get("textarea").setValue("Unsent next question");
      const composer = wrapper.get("textarea").element;
      flow.sending.value = true;
      flow.busy.value = true;
      chat.value.messages[0]!.content = "Continued answer";
      // useChatGeneration applies this field from the terminal stream event.
      chat.value.categoryId = categoryId;
      flow.sending.value = false;
      flow.busy.value = false;
      await flushPromises();
      await vi.waitFor(() =>
        expect(useRouter().currentRoute.value.query.category).toBe(
          categoryId ?? "uncategorized",
        ),
      );
      expect(wrapper.text()).toContain(categoryId ? "Target" : "Uncategorized");
      expect(wrapper.text()).toContain("Continued answer");
      expect(wrapper.get("textarea").element).toBe(composer);
      expect(wrapper.get("textarea").element.value).toBe(
        "Unsent next question",
      );
      expect(load).toHaveBeenCalledOnce();
      expect(request).not.toHaveBeenCalled();
    },
  );
});

describe("Chat category deletion", () => {
  it("reloads a deleted current category after generation and moves the route to Uncategorized", async () => {
    const { wrapper, categories, load, chat } = await categorySession();
    await wrapper.get("textarea").setValue("Next question draft");
    const composer = wrapper.get("textarea").element;
    flow.sending.value = true;
    flow.busy.value = true;
    chat.value!.messages[0]!.content = "Partial response";
    chat.value!.messages[0]!.status = "generating";
    withoutWorkCategory(categories);
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(chat.value!.messages[0]!.content).toBe("Partial response");
    expect(useRouter().currentRoute.value.query.category).toBe("work");
    flow.sending.value = false;
    flow.busy.value = false;
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
    expect(chat.value?.categoryId).toBeNull();
    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.query.category).toBe(
        "uncategorized",
      );
    });
    expect(wrapper.text()).toContain("Uncategorized");
    expect(chat.value!.messages[0]).toMatchObject({
      content: "Answer",
      status: "completed",
    });
    expect(wrapper.get("textarea").element).toBe(composer);
    expect(wrapper.get("textarea").element.value).toBe("Next question draft");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not reload history when the current category still exists", async () => {
    const { categories, load } = await categorySession();
    flow.sending.value = true;
    categories.value = {
      ...categories.value!,
      items: [...categories.value!.items],
    };
    flow.sending.value = false;
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(useRouter().currentRoute.value.query.category).toBe("work");
  });

  it("does not assume a missing category is deleted if the server still assigns it", async () => {
    const { categories, load, chat } = await categorySession();
    load.mockResolvedValueOnce(conversation);
    withoutWorkCategory(categories);
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
    expect(chat.value?.categoryId).toBe("work");
    expect(useRouter().currentRoute.value.query.category).toBe("work");
  });

  it("keeps the conversation and shows reload guidance if category synchronization fails", async () => {
    const { wrapper, categories, load, chat } = await categorySession();
    load.mockRejectedValueOnce(new Error("offline"));
    withoutWorkCategory(categories);
    await flushPromises();
    expect(chat.value?.categoryId).toBe("work");
    expect(wrapper.text()).toContain("Could not reload this chat's category");
    expect(wrapper.text()).toContain("Answer");
    expect(useRouter().currentRoute.value.query.category).toBe("work");
    expect(request).not.toHaveBeenCalled();
  });
});
