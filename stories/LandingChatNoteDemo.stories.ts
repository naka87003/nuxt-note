import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { expect, userEvent, within } from "storybook/test";
import LandingChatNoteDemo from "../app/components/LandingChatNoteDemo.vue";
import { landingDecorators, waitForLandingAssets } from "./fixtures/landing";

async function confirmGeneration(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(
    await canvas.findByRole("button", { name: "Generate draft" }),
  );
  const dialog = await canvas.findByRole("dialog", {
    name: "Generate a draft from this chat?",
  });
  await expect(dialog).toBeVisible();
  return within(dialog);
}

async function editDemoDraft(canvasElement: HTMLElement) {
  const dialog = await confirmGeneration(canvasElement);
  await userEvent.click(dialog.getByRole("button", { name: "Generate" }));
  const canvas = within(canvasElement);
  // The real demo finishes generation after two seconds; wait for the UI state.
  await expect(
    await canvas.findByRole("textbox", { name: "Title" }, { timeout: 5000 }),
  ).toBeVisible();
}

const meta = {
  title: "Landing/Chat to note demo",
  component: LandingChatNoteDemo,
  decorators: landingDecorators,
  // The landing page only mounts the interactive demo at desktop widths.
  parameters: { chromatic: { viewports: [1024, 1280] } },
} satisfies Meta<typeof LandingChatNoteDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GenerationConfirmation: Story = {
  play: async ({ canvasElement }) => {
    await confirmGeneration(canvasElement);
    await waitForLandingAssets(canvasElement);
  },
};

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await editDemoDraft(canvasElement);
    await waitForLandingAssets(canvasElement);
  },
};

export const DiscardConfirmation: Story = {
  play: async ({ canvasElement }) => {
    await editDemoDraft(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(
      await canvas.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Keep editing" }),
    ).toHaveFocus();
    await waitForLandingAssets(canvasElement);
  },
};

export const Saved: Story = {
  play: async ({ canvasElement }) => {
    await editDemoDraft(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(
      await canvas.findByRole(
        "button",
        { name: "Try again" },
        { timeout: 5000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.getByText("Saved to Notes", { exact: true }),
    ).toBeVisible();
    await waitForLandingAssets(canvasElement);
  },
};
