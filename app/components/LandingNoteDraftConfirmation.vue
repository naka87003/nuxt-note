<script setup lang="ts">
withDefaults(
  defineProps<{
    interactive?: boolean;
    title?: string;
    titleId?: string;
    focusTitle?: boolean;
  }>(),
  { title: "Generate a note from this chat?", titleId: undefined },
);
</script>

<template>
  <div
    class="sample-confirmation"
    :class="{ 'is-interactive': interactive }"
    :aria-hidden="interactive ? undefined : true"
  >
    <section
      class="sample-dialog"
      :role="interactive ? 'dialog' : undefined"
      :aria-labelledby="interactive ? titleId : undefined"
    >
      <component
        :is="interactive ? 'h3' : 'div'"
        :id="titleId"
        class="sample-dialog-header"
        :tabindex="interactive ? -1 : undefined"
        :data-demo-focus="focusTitle ? '' : undefined"
        >{{ title }}</component
      >
      <div class="sample-dialog-description">
        <slot
          ><p>
            AI will organize this conversation into a draft. You can review and
            edit it before saving.
          </p></slot
        >
      </div>
      <div v-if="!interactive || $slots.actions" class="sample-dialog-actions">
        <slot name="actions">
          <span class="sample-dialog-cancel">Cancel</span>
          <span class="sample-primary">Generate</span>
        </slot>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sample-confirmation {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.sample-confirmation::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--ui-bg-elevated);
  opacity: 0.78;
}
.is-interactive {
  z-index: 2;
}
.is-interactive::before {
  background: rgb(8 14 20);
  opacity: 0.52;
}
.is-interactive .sample-dialog {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: visible;
  box-shadow: 0 20px 64px rgb(0 0 0 / 25%);
}
.is-interactive .sample-dialog-description {
  min-height: 0;
  overflow: auto;
}
.is-interactive .sample-dialog-header,
.is-interactive .sample-dialog-actions {
  flex-shrink: 0;
}
.sample-dialog {
  position: relative;
  width: 512px;
  max-width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
}
.sample-dialog-header {
  padding: 24px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.sample-dialog-description {
  padding: 24px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 16px;
  line-height: 24px;
}
.sample-dialog-actions {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
}
.sample-dialog-actions > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  white-space: nowrap;
}
.sample-dialog-cancel {
  border: 1px solid var(--ui-border-accented);
}
.sample-primary {
  color: var(--ui-bg);
  background: var(--ui-primary);
}
</style>
