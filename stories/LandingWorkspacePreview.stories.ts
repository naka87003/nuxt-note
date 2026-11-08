import type { Meta, StoryObj } from "@nuxtjs/storybook";
import LandingWorkspacePreview from "../app/components/LandingWorkspacePreview.vue";
import { landingDecorators, waitForLandingAssets } from "./fixtures/landing";

const meta = {
  title: "Landing/Workspace preview",
  component: LandingWorkspacePreview,
  decorators: landingDecorators,
  parameters: { chromatic: { viewports: [390, 1024, 1280] } },
  args: { mode: "notes" },
  play: async ({ canvasElement }) => waitForLandingAssets(canvasElement),
} satisfies Meta<typeof LandingWorkspacePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notes: Story = {};
export const Chat: Story = {
  args: { mode: "chat" },
  // Match the landing Chat section: a half-width column from 1280px.
  render: (args) => ({
    components: { LandingWorkspacePreview },
    setup: () => ({ args }),
    template:
      '<div class="ml-auto min-w-0 w-full xl:w-[calc((100%-48px)/2)]"><LandingWorkspacePreview v-bind="args" /></div>',
  }),
};
