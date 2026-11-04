<script setup lang="ts">
import { INPUT_LIMITS } from "#shared/utils/input-limits";
const value = defineModel<string>({ default: "" });

const props = defineProps<{
  busy?: boolean;
  disabled?: boolean;
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

onMounted(resize);

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
