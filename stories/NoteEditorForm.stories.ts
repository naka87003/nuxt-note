import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { ref } from "vue";
import { expect, userEvent, within } from "storybook/test";
import NoteEditorForm from "../app/components/NoteEditorForm.vue";
import { categoryOptions, markdown } from "./fixtures/content";

const meta = {
  title: "Notes/Editor",
  component: NoteEditorForm,
  args: {
    title: "Building a knowledge base with Nuxt",
    markdown,
    category: "development",
    categoryOptions,
    note: true,
    dirty: true,
  },
  render: (args) => ({
    components: { NoteEditorForm },
    setup: () => ({
      args,
      title: ref(args.title),
      markdown: ref(args.markdown),
      category: ref(args.category),
    }),
    template:
      '<div style="display: flex; height: 900px"><NoteEditorForm v-bind="args" v-model:title="title" v-model:markdown="markdown" v-model:category="category" /></div>',
  }),
} satisfies Meta<typeof NoteEditorForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editing: Story = {};
export const NewEmptyNote: Story = {
  args: {
    note: false,
    dirty: false,
    title: "",
    markdown: "",
    category: "uncategorized",
  },
};
export const Unchanged: Story = { args: { dirty: false } };
export const Saving: Story = { args: { saving: true } };
export const SaveFailed: Story = {
  args: { failure: "Your changes could not be saved. Please try again." },
};
export const OverLimit: Story = { args: { overLimit: true } };
export const Preview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /^Preview$/ }));
    await expect(
      canvas.getByRole("region", { name: "Markdown preview" }),
    ).toBeVisible();
  },
};
