<template>
  <svg
    class="click-cue"
    viewBox="0 0 32 36"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M11 20V6a2.6 2.6 0 0 1 5.2 0v9-2a2.4 2.4 0 0 1 4.8 0v2a2.3 2.3 0 0 1 4.6 0v2a2.2 2.2 0 0 1 4.4 0v7c0 3.4-1.3 5.5-3.2 8H15c-1.4-2.2-3.1-4.3-5.2-6.6L4 19a2.6 2.6 0 0 1 3.8-3.5L11 20Z"
      fill="#fff"
      stroke="#253044"
      stroke-width="1.7"
      stroke-linejoin="round"
    />
  </svg>
</template>
<style scoped>
.click-cue {
  position: absolute;
  z-index: 2;
  right: 3px;
  top: calc(100% - 6px);
  width: 30px;
  height: 34px;
  pointer-events: none;
  transform: rotate(-24deg);
  transform-origin: 42% 16%;
  filter: drop-shadow(0 2px 2px #0004);
}
@media (prefers-reduced-motion: no-preference) {
  .click-cue {
    animation: point-at-button 1.8s ease-in-out infinite;
  }
  @keyframes point-at-button {
    50% {
      transform: translate(2px, 4px) rotate(-18deg);
    }
  }
}
</style>
