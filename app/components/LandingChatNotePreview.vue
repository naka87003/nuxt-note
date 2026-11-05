<script setup lang="ts">
// Render the static preview on the server and mount the demo only on wider screens.
const desktop = ref(false);

onMounted(() => {
  const media = window.matchMedia("(min-width: 1024px)");
  const update = () => {
    desktop.value = media.matches;
  };
  update();
  media.addEventListener("change", update);
  onBeforeUnmount(() => media.removeEventListener("change", update));
});
</script>

<template>
  <LazyLandingChatNoteDemo v-if="desktop" />
  <LandingWorkspacePreview v-else mode="chat" note-draft />
</template>
