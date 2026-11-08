import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { useNuxtData, useState } from "#imports";
import { watchEffect } from "vue";
import type { CategoriesResponse } from "../shared/types/workspace";
import { useWorkspace } from "../app/composables/useWorkspace";
import WorkspaceList from "../app/components/WorkspaceList.vue";

type ListArgs = InstanceType<typeof WorkspaceList>["$props"] & {
  search: string;
};

const meta = {
  title: "Workspace/List",
  component: WorkspaceList,
  args: {
    items: [],
    heading: "All notes",
    loading: false,
    failed: false,
    search: "",
  },
  render: (args) => ({
    components: { WorkspaceList },
    setup() {
      useState("workspace-list-now", () => "2026-11-08T12:00:00.000Z").value =
        "2026-11-08T12:00:00.000Z";
      const { data: categories } = useNuxtData<CategoriesResponse>(
        "workspace-categories",
      );
      categories.value = {
        items: [
          {
            id: "development",
            name: "Development",
            _count: { notes: 4, chats: 0 },
          },
        ],
        totals: { notes: 4, chats: 0 },
        uncategorized: { notes: 0, chats: 0 },
      };
      const { state } = useWorkspace();
      watchEffect(() => {
        state.value.filter = "all";
        state.value.notes = {
          search: args.search,
          selected: "note-today",
          scroll: 0,
          hidden: false,
        };
      });
      return { args };
    },
    template:
      '<div style="display: flex; height: 760px"><WorkspaceList :items="args.items" :heading="args.heading" :loading="args.loading" :failed="args.failed" /></div>',
  }),
} satisfies Meta<ListArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithNotes: Story = {
  args: {
    items: [
      {
        id: "note-today",
        title: "Nuxt composables",
        preview:
          "Capture reusable application logic and keep your components focused.",
        categoryId: "development",
        updatedAt: "2026-11-08T06:00:00.000Z",
      },
      {
        id: "note-week",
        title:
          "A long note title that should wrap across lines without moving the date or category outside the card",
        preview:
          "A long preview to exercise wrapping on narrow screens. ".repeat(3),
        categoryId: "development",
        updatedAt: "2026-11-05T06:00:00.000Z",
      },
      {
        id: "note-month",
        title: null,
        preview: "An untitled note without a category.",
        categoryId: null,
        updatedAt: "2026-10-20T06:00:00.000Z",
      },
      {
        id: "note-older",
        title: "Getting started",
        preview: "The first ideas in this workspace.",
        categoryId: "development",
        updatedAt: "2026-08-01T06:00:00.000Z",
      },
    ],
  },
};
export const Empty: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Failed: Story = { args: { failed: true } };
export const NoSearchResults: Story = { args: { search: "missing note" } };
