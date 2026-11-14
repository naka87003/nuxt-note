import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { ref } from "vue";
import { expect, fn, within } from "storybook/test";
import NoteConflictDialog from "@/components/NoteConflictDialog.vue";

const meta = {
  title: "Notes/Conflict confirmation",
  component: NoteConflictDialog,
  args: {
    open: true,
    saving: false,
    failure: "",
    onOverwrite: fn(),
  },
  render: (args) => ({
    components: { NoteConflictDialog },
    setup: () => ({ args, open: ref(args.open) }),
    template: '<NoteConflictDialog v-bind="args" v-model:open="open" />',
  }),
} satisfies Meta<typeof NoteConflictDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmation: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    await expect(
      dialog.getByText("This note was updated elsewhere"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Overwrite and save" }),
    ).toBeEnabled();
    await expect(dialog.getAllByRole("button")).toHaveLength(3);
  },
};
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = within(await page.findByRole("dialog"));
    for (const name of ["Keep editing", "Overwrite and save"])
      await expect(dialog.getByRole("button", { name })).toBeDisabled();
    await expect(
      dialog.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();
  },
};
export const SaveFailed: Story = {
  args: {
    failure:
      "Could not save your note. Your changes are still here. Please try again.",
  },
};
