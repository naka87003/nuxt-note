<script setup lang="ts">
import { INPUT_LIMITS } from "#shared/utils/input-limits";
const value = defineModel<string>({ default: "" });

const props = defineProps<{
  busy?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
}>();

const textarea = ref<HTMLTextAreaElement>();

function resize() {
  if (!textarea.value) return;
  textarea.value.style.height = "auto";
  textarea.value.style.height = `${Math.max(24, Math.min(textarea.value.scrollHeight, 160))}px`;
}

function focusInput() {
  if (!props.busy && !props.disabled) textarea.value?.focus();
}

onMounted(() => {
  resize();
  if (props.autofocus) {
    focusInput();
    textarea.value?.setSelectionRange(value.value.length, value.value.length);
  }
});

watch(value, resize, { flush: "post" });

const emit = defineEmits<{ send: [] }>();
const canSend = computed(
  () =>
    !props.busy &&
    !props.disabled &&
    !!value.value.trim() &&
    value.value.length <= INPUT_LIMITS.chatMessage,
);

function send() {
  if (canSend.value) emit("send");
}

function keydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}
</script>
<template>
  <form class="chat-composer" @click.self="focusInput" @submit.prevent="send">
    <textarea
      ref="textarea"
      v-model="value"
      :disabled="busy || disabled"
      rows="1"
      :maxlength="INPUT_LIMITS.chatMessage"
      aria-label="Message"
      placeholder="Ask anything…"
      @keydown="keydown"
    />
    <UButton
      type="submit"
      :disabled="!canSend"
      class="chat-send"
      aria-label="Send message"
    >
      <img src="/icons/chat-send.svg" alt="" width="20" height="20" />
    </UButton>
  </form>
</template>

<style scoped>
.chat-composer {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 12px 12px 12px 19.2px;
  gap: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 28.8px;
  background: var(--ui-bg);
}
.chat-composer textarea {
  width: 100%;
  min-width: 0;
  min-height: 24px;
  line-height: 24px;
  resize: none;
  outline: none;
  background: transparent;
  max-height: 160px;
  overflow-y: auto;
  font-size: 16px;
}
.chat-send {
  flex-shrink: 0;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 6px;
  border-radius: 999px;
}
@media (max-width: 767px) {
  .chat-send {
    width: 44px;
    height: 44px;
  }
  .chat-composer {
    padding-block: 6px;
  }
  .chat-composer textarea {
    min-height: 44px;
    padding-block: 10px;
  }
}
</style>
