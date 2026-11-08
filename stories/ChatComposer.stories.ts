import type { Meta, StoryObj } from "@nuxtjs/storybook";
import { ref } from "vue";
import ChatComposer from "../app/components/ChatComposer.vue";

const meta = {
  title: "Chat/Composer",
  component: ChatComposer,
  args: { modelValue: "", busy: false, disabled: false },
  render: (args) => ({
    components: { ChatComposer },
    setup: () => ({ args, draft: ref(args.modelValue) }),
    template:
      '<div style="max-width: 800px; padding: 24px; margin: auto"><ChatComposer v-bind="args" v-model="draft" /></div>',
  }),
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithMessage: Story = {
  args: { modelValue: "How can I organize my Nuxt notes?" },
};
export const Multiline: Story = {
  args: {
    modelValue:
      "Please summarize these points:\n1. Nuxt composables\n2. Markdown previews\n3. Saving a conversation as a note",
  },
};
export const Sending: Story = {
  args: { modelValue: "Summarize this conversation.", busy: true },
};
export const Disabled: Story = { args: { disabled: true } };
