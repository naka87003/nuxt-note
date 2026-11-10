<script setup lang="ts">
const dots = [
  { x: 10, y: 25, size: 6, duration: 10, delay: -2, drift: 24 },
  { x: 24, y: 65, size: 8, duration: 13, delay: -7, drift: -32 },
  { x: 39, y: 16, size: 6, duration: 11, delay: -4, drift: 20 },
  { x: 52, y: 78, size: 6, duration: 15, delay: -10, drift: -24 },
  { x: 65, y: 40, size: 8, duration: 12, delay: -6, drift: 32 },
  { x: 77, y: 72, size: 6, duration: 14, delay: -3, drift: -20 },
  { x: 88, y: 20, size: 6, duration: 9, delay: -5, drift: 24 },
  { x: 94, y: 56, size: 8, duration: 16, delay: -12, drift: -28 },
];
</script>

<template>
  <div class="background-dots" aria-hidden="true">
    <span
      v-for="dot in dots"
      :key="dot.x"
      class="dot"
      :style="{
        left: `${dot.x}%`,
        top: `${dot.y}%`,
        width: `${dot.size}px`,
        '--duration': `${dot.duration}s`,
        '--delay': `${dot.delay}s`,
        '--drift': `${dot.drift}px`,
      }"
    />
  </div>
</template>

<style scoped>
.background-dots {
  position: absolute;
  inset: 0 0 auto;
  z-index: -1;
  height: min(900px, 100svh);
  overflow: hidden;
  pointer-events: none;
}
.dot {
  position: absolute;
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ui-primary) 30%, transparent);
  filter: blur(1px);
  opacity: 0.35;
}
@media (prefers-reduced-motion: no-preference) {
  .dot {
    animation: dot-drift var(--duration) linear var(--delay) infinite;
  }
}
@keyframes dot-drift {
  from {
    opacity: 0;
    transform: translate(0, 24px);
  }
  25%,
  75% {
    opacity: 0.8;
  }
  to {
    opacity: 0;
    transform: translate(var(--drift), -80px);
  }
}
</style>
