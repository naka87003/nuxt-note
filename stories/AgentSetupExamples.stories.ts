import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { expect, userEvent, waitFor, within } from "storybook/test";
import AgentSetupExamples from "../app/components/AgentSetupExamples.vue";

const meta = {
  title: "Settings/Agent setup examples",
  component: AgentSetupExamples,
  args: { endpoint: "https://nuxt-note-ivory.vercel.app/mcp" },
  decorators: [
    () => ({
      template:
        '<div style="max-width: 768px; padding: 24px; margin: auto"><story /></div>',
    }),
  ],
} satisfies Meta<typeof AgentSetupExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Codex", { exact: true }));
    await expect(canvasElement.querySelector("details")).toHaveAttribute(
      "open",
    );
    await waitFor(async () => {
      const code = canvasElement.querySelector("pre code");
      await expect(code).toBeVisible();
      await expect(code).toHaveTextContent("[mcp_servers.nuxt-note]");
      await expect(code).toHaveTextContent(
        'Authorization = "Bearer YOUR_TOKEN"',
      );
    });
  },
};
