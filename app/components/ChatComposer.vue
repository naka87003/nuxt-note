<template>
  <div
    class="chat-composer"
    aria-label="Chat input unavailable until AI generation is connected"
  >
    <textarea
      disabled
      rows="1"
      aria-label="Message (AI generation is not available yet)"
    />
    <UButton
      disabled
      class="chat-send"
      aria-label="Send message (AI generation is not available yet)"
      ><img src="/icons/chat-send.svg" alt="" width="20" height="20"
    /></UButton>
  </div>
</template>
