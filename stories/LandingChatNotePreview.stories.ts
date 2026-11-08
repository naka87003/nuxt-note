import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { expect, within } from "storybook/test";
import LandingChatNotePreview from "../app/components/LandingChatNotePreview.vue";
import { landingDecorators, waitForLandingAssets } from "./fixtures/landing";

const meta = {
  title: "Landing/Chat to note preview",
  component: LandingChatNotePreview,
  decorators: landingDecorators,
  parameters: { chromatic: { viewports: [390, 1024, 1280] } },
} satisfies Meta<typeof LandingChatNotePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Responsive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const desktop = canvasElement.ownerDocument.defaultView!.matchMedia(
      "(min-width: 1024px)",
    ).matches;
    if (desktop) {
      // Wait for the real lazy component, rather than capturing the SSR fallback.
      await expect(
        await canvas.findByRole("button", {
          name: "Generate note",
        }),
      ).toBeVisible();
    } else {
      await expect(
        canvas.getByRole("img", {
          name: /Example Chat workspace with a Generate note confirmation/,
        }),
      ).toBeVisible();
      await expect(
        canvas.queryByRole("button", { name: "Generate note" }),
      ).not.toBeInTheDocument();
    }
    await waitForLandingAssets(canvasElement);
  },
};
