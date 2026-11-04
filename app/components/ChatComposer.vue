<script setup lang="ts">
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

function keydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!props.busy && !props.disabled && value.value.trim()) emit("send");
  }
}
</script>
<template>
  <form
    class="chat-composer"
    @click.self="focusInput"
    @submit.prevent="emit('send')"
  >
    <textarea
      ref="textarea"
      v-model="value"
      :disabled="busy || disabled"
      rows="1"
      maxlength="20000"
      aria-label="Message"
      @keydown="keydown"
    />
    <UButton
      type="submit"
      :disabled="busy || disabled || !value.trim()"
      class="chat-send"
      aria-label="Send message"
    >
      <img src="/icons/chat-send.svg" alt="" width="20" height="20" />
    </UButton>
  </form>
</template>
