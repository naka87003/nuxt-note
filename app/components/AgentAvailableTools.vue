<script setup lang="ts">
const groups = [
  {
    name: "Notes",
    tools: [
      { name: "list_notes", description: "Search notes by title or content." },
      { name: "get_note", description: "Read a note’s full Markdown content." },
      { name: "create_note", description: "Create a new note." },
      {
        name: "update_note",
        description:
          "Update a note’s title and content, and optionally its category.",
      },
      { name: "update_note_title", description: "Change only a note’s title." },
      {
        name: "update_note_category",
        description: "Change only a note’s category.",
      },
      { name: "delete_note", description: "Permanently delete a note." },
    ],
  },
  {
    name: "Chats",
    tools: [
      {
        name: "list_chats",
        description: "Search saved chats by title or message content.",
      },
      {
        name: "get_chat",
        description: "Read a saved chat’s messages, one page at a time.",
      },
      { name: "update_chat_title", description: "Change only a chat’s title." },
      {
        name: "update_chat_category",
        description: "Change only a chat’s category.",
      },
      {
        name: "delete_chat",
        description: "Permanently delete a chat and all its messages.",
      },
    ],
  },
  {
    name: "Categories",
    tools: [
      {
        name: "list_categories",
        description: "List all categories, including empty ones.",
      },
      {
        name: "get_category",
        description: "Read a category’s name and its note and chat counts.",
      },
      { name: "create_category", description: "Create a new category." },
      { name: "update_category", description: "Rename a category." },
      {
        name: "move_category_notes",
        description:
          "Move all notes from one category to another, including Uncategorized.",
      },
      {
        name: "move_category_chats",
        description:
          "Move all chats from one category to another, including Uncategorized.",
      },
      {
        name: "merge_categories",
        description:
          "Move all notes and chats into another category, then permanently delete the source category.",
      },
      {
        name: "delete_category",
        description:
          "Permanently delete a category. Its notes and chats become Uncategorized.",
      },
    ],
  },
];
const toolCount = groups.reduce(
  (total, group) => total + group.tools.length,
  0,
);
</script>

<template>
  <details class="rounded-lg border border-default p-5">
    <summary
      class="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <h2 class="inline text-lg font-semibold">
        Available tools
        <span class="ml-2 text-sm font-normal text-muted">
          {{ toolCount }} tools
        </span>
      </h2>
    </summary>
    <div class="mt-4 space-y-6">
      <p class="text-sm text-muted">
        Every token gives access to all tools listed below for your Notes,
        Chats, and Categories.
      </p>
      <section
        v-for="group in groups"
        :key="group.name"
        :aria-labelledby="`agent-tools-${group.name.toLowerCase()}`"
        class="space-y-3"
      >
        <h3
          :id="`agent-tools-${group.name.toLowerCase()}`"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-elevated px-3 py-2 text-base font-semibold"
        >
          {{ group.name }}
          <span class="text-sm font-normal text-muted">
            {{ group.tools.length }} tools
          </span>
        </h3>
        <dl class="divide-y divide-default">
          <div
            v-for="tool in group.tools"
            :key="tool.name"
            class="space-y-1 py-2 first:pt-0 last:pb-0"
          >
            <dt class="text-sm">
              <code class="wrap-anywhere">{{ tool.name }}</code>
            </dt>
            <dd class="text-sm text-muted">{{ tool.description }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </details>
</template>
