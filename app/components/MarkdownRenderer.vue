<script setup lang="ts">
import { createNoteMarkdownParser } from "~/utils/markdown";
import type { MarkdownDocument } from "@comark/nuxt/parse";
import MarkdownCodeBlock from "~/components/MarkdownCodeBlock.vue";

const props = withDefaults(
  defineProps<{ content: string; streaming?: boolean; copyable?: boolean }>(),
  { streaming: false, copyable: true },
);
provide(
  "markdown-copyable",
  computed(() => props.copyable),
);

const components = { pre: MarkdownCodeBlock };

const parse = createNoteMarkdownParser();

const document = shallowRef<MarkdownDocument>({
  nodes: [],
  meta: {},
  frontmatter: {},
});

let revision = 0;
async function update(content: string, streaming: boolean) {
  const current = ++revision;
  const result = await parse(content, { streaming });
  if (current === revision) document.value = result;
}

const initial = update(props.content, props.streaming);

watch(
  () => [props.content, props.streaming] as const,
  ([content, streaming]) => update(content, streaming),
);
await initial;
</script>

<template>
  <MarkdownDocument :value="document" :components="components" />
</template>
