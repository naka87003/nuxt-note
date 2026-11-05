<template>
  <span class="success-mark" aria-hidden="true">
    <UIcon name="i-lucide-check" />
    <i v-for="n in 8" :key="n" :style="{ '--ray': n * 45 + 'deg' }" />
  </span>
</template>

<style scoped>
.success-mark {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 1em;
  height: 1em;
  font-size: 16px;
  border-radius: 50%;
  background: var(--ui-primary);
  color: var(--ui-bg);
}
.success-mark i {
  display: none;
}
@media (prefers-reduced-motion: no-preference) {
  .success-mark {
    animation: stamp-in 1100ms ease-in-out;
  }
  .success-mark i {
    position: absolute;
    top: calc(50% - 3px);
    left: calc(50% - 1.5px);
    display: block;
    width: 3px;
    height: 6px;
    border-radius: 2px;
    background: var(--ui-primary);
    animation: celebrate 900ms 220ms ease-out both;
  }
  .success-mark i:nth-of-type(even) {
    background: #e8b547;
  }
  @keyframes stamp-in {
    from {
      transform: scale(0.65);
      opacity: 0;
    }
    35%,
    52% {
      transform: scale(1.85);
      opacity: 1;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  @keyframes celebrate {
    from {
      opacity: 0;
      transform: rotate(var(--ray)) translateY(-13px);
    }
    25% {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: rotate(var(--ray)) translateY(-32px) scale(0.55);
    }
  }
}
</style>
