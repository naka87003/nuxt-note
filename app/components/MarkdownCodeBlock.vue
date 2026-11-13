<script setup lang="ts">
import type { ElementNode } from "@comark/nuxt/parse";
import { textContent } from "@comark/nuxt/utils";

defineOptions({ inheritAttrs: false });
// eslint-disable-next-line vue/prop-name-casing -- Comark's documented AST prop.
const props = defineProps<{ __node: ElementNode }>();
const code = computed(() => textContent(props.__node));
const copyable = inject<Ref<boolean>>("markdown-copyable", ref(true));
const active = ref(false);
const { state, pending, feedback, copy } = useCopyFeedback(
  code,
  "Code copied to clipboard.",
);
</script>

<template>
  <div
    class="code-block"
    :class="{
      'code-block--active': active,
      'code-block--copyable': copyable,
    }"
    @click="active = true"
  >
    <UButton
      v-if="copyable"
      class="code-copy"
      type="button"
      :icon="feedback.icon"
      :color="feedback.color"
      variant="ghost"
      size="sm"
      :disabled="pending"
      aria-label="Copy code"
      :data-state="state"
      @click.stop="copy"
    />
    <pre><slot /></pre>
    <span v-if="copyable" class="sr-only" role="status">
      {{ feedback.message }}
    </span>
  </div>
</template>

<style scoped>
.code-block {
  position: relative;
}
.code-block--copyable {
  min-width: 0;
  border-radius: 6px;
  background: var(--ui-bg-muted);
  overflow: hidden;
}
.code-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  justify-content: center;
  background: var(--ui-bg-muted);
  opacity: 0;
  pointer-events: none;
}
.code-block:is(:focus-within, .code-block--active) .code-copy {
  opacity: 1;
  pointer-events: auto;
}
@media (hover: hover) and (pointer: fine) {
  .code-block:hover .code-copy {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
