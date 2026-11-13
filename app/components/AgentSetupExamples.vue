<script setup lang="ts">
const props = defineProps<{ endpoint: string }>();

const codexConfigMarkdown = computed(() => {
  const config = `[mcp_servers.nuxt-note]
url = ${JSON.stringify(props.endpoint)}

[mcp_servers.nuxt-note.http_headers]
Authorization = "Bearer YOUR_TOKEN"`;
  return ["```toml", config, "```"].join("\n");
});
</script>

<template>
  <div class="space-y-3 border-t border-default pt-4">
    <h3 class="text-sm font-medium">Agent setup examples</h3>
    <details class="rounded-md border border-default p-4">
      <summary class="cursor-pointer text-sm font-medium">Codex</summary>
      <div class="mt-4 space-y-4 text-sm">
        <ol class="list-decimal space-y-2 pl-5">
          <li>
            Add the example below to <code>~/.codex/config.toml</code>, keeping
            your existing settings. If a
            <code>mcp_servers.nuxt-note</code> entry already exists, update it
            instead of adding a duplicate.
          </li>
          <li>
            Replace <code>YOUR_TOKEN</code> with your token, keeping the
            <code>Bearer </code> prefix and the space after it.
          </li>
          <li>Save the file, restart Codex, and try the prompt above.</li>
        </ol>
        <MarkdownContent :content="codexConfigMarkdown" />
        <p class="text-muted">
          The example uses this site's MCP URL and a placeholder token.
        </p>
      </div>
    </details>
  </div>
</template>
