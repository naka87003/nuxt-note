import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, expect, it } from "vitest";
import { clearNuxtState, useRouter, useUserSession } from "#imports";
import ChatPage from "~/pages/chats/[[id]].vue";

beforeEach(() => {
  clearNuxtState();
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

async function mountPage(route: string) {
  return await mountSuspended(ChatPage, {
    route,
    global: {
      stubs: {
        ChatSession: {
          name: "ChatSession",
          props: ["chatId", "initialDraft"],
          template: "<div />",
        },
      },
    },
  });
}

it("prefills the Note URL only for a new chat and clears it for ordinary New chat navigation", async () => {
  const wrapper = await mountPage("/chats/new?category=work&note=note-1");
  const session = () => wrapper.getComponent({ name: "ChatSession" });
  expect(session().props("chatId")).toBe("");
  expect(session().props("initialDraft")).toMatch(
    /^https?:\/\/[^\s]+\/notes\/note-1\n\n$/,
  );

  // Selecting another category must preserve the current draft/session.
  const original = session().vm;
  await useRouter().push("/chats/new?category=other&note=note-1");
  await flushPromises();
  expect(session().vm).toBe(original);

  await useRouter().push("/chats/new?category=work");
  await flushPromises();
  expect(session().props("initialDraft")).toBe("");
  expect(session().vm).not.toBe(original);
});

it.each([
  "/chats/existing?note=note-1",
  "/chats/new?note=https://other.example/note",
])("does not seed a draft for %s", async (route) => {
  const wrapper = await mountPage(route);
  expect(
    wrapper.getComponent({ name: "ChatSession" }).props("initialDraft"),
  ).toBe("");
});

it("keeps the active session when the first send creates a chat", async () => {
  const wrapper = await mountPage("/chats/new?note=note-1");
  const session = wrapper.getComponent({ name: "ChatSession" });
  session.vm.$emit("created", "saved-chat");
  await useRouter().push("/chats/saved-chat?category=work");
  await flushPromises();
  expect(wrapper.getComponent({ name: "ChatSession" }).vm).toBe(session.vm);
});
