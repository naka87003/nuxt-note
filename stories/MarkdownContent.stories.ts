import type { Meta, StoryObj } from "@nuxtjs/storybook";
import MarkdownContent from "@/components/MarkdownContent.vue";
import { markdown } from "./fixtures/content";

const meta = {
  title: "Notes/Markdown",
  component: MarkdownContent,
  args: { content: markdown },
  decorators: [
    () => ({
      template:
        '<article style="max-width: 800px; padding: 24px; margin: auto; line-height: 1.7"><story /></article>',
    }),
  ],
} satisfies Meta<typeof MarkdownContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RichContent: Story = {};
export const LongContent: Story = {
  args: {
    content: [
      "## Long content / 長い文章",
      "長い文章でもレイアウトが崩れずに表示されることを確認します。".repeat(8),
      "",
      `https://example.com/${"long-path-".repeat(24)}`,
      "",
      "```ts",
      `const longLine = "${"long content ".repeat(24)}";`,
      "```",
      "",
      "| Name | Description | Detail |",
      "| --- | --- | --- |",
      `| Note | ${"Wide table content ".repeat(12)} | Ready |`,
    ].join("\n"),
  },
};
