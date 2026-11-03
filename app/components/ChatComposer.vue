<script setup lang="ts">
const value = defineModel<string>({ default: "" });
const props = defineProps<{
  busy?: boolean;
  disabled?: boolean;
  canStop?: boolean;
}>();
const textarea = ref<HTMLTextAreaElement>();
function resize() {
  if (!textarea.value) return;
  textarea.value.style.height = "auto";
  textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 160)}px`;
}
onMounted(resize);
watch(value, resize, { flush: "post" });
const emit = defineEmits<{ send: []; stop: [] }>();
function keydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!props.busy && !props.disabled && value.value.trim()) emit("send");
  }
}
</script>
<template>
  <form class="chat-composer" @submit.prevent="emit('send')">
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
      v-if="busy"
      type="button"
      :disabled="canStop === false"
      class="chat-send"
      icon="i-lucide-square"
      aria-label="Stop generating"
      @click="emit('stop')"
    />
    <UButton
      v-else
      type="submit"
      :disabled="disabled || !value.trim()"
      class="chat-send"
      aria-label="Send message"
    >
      <img src="/icons/chat-send.svg" alt="" width="20" height="20" />
    </UButton>
  </form>
</template>
