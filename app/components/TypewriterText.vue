<script setup lang="ts">
const props = defineProps<{ text: string }>();
const textElement = useTemplateRef("textElement");
let animation: Animation | undefined;

watch(
  () => props.text,
  (text) => {
    animation?.cancel();
    const element = textElement.value;
    const characters = Array.from(text).length;
    if (
      !element?.animate ||
      !characters ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    animation = element.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      {
        duration: Math.min(characters * 50, 1000),
        easing: `steps(${characters}, end)`,
      },
    );
  },
  { flush: "post" },
);

onBeforeUnmount(() => animation?.cancel());
</script>

<template>
  <span ref="textElement" class="block">{{ text }}</span>
</template>
