<template>
  <div class="landing-gradient" aria-hidden="true" />
</template>

<style scoped>
.landing-gradient {
  position: absolute;
  z-index: -2;
  top: 0;
  left: 0;
  width: 100%;
  height: 1250px;
  pointer-events: none;
  background:
    linear-gradient(
        to bottom,
        var(--ui-bg) 0%,
        var(--ui-bg) 45%,
        transparent 100%
      )
      top / 100% 180px no-repeat,
    linear-gradient(
      to right,
      var(--ui-bg) 46%,
      color-mix(in srgb, var(--ui-bg) 88%, transparent) 52%,
      transparent 66%
    ),
    radial-gradient(
      ellipse 510px 380px at calc(50% + 490px) 440px,
      color-mix(in srgb, var(--ui-primary) 28%, transparent),
      color-mix(in srgb, var(--ui-primary) 13.44%, transparent) 46%,
      transparent
    ),
    radial-gradient(
      ellipse 480px 390px at calc(50% + 720px) 530px,
      #14b8a638,
      #14b8a61b 46%,
      transparent
    ),
    radial-gradient(
      ellipse 600px 400px at calc(50% + 560px) 760px,
      #3b82f62e,
      #3b82f616 46%,
      transparent
    );
}
@media (max-width: 1279px) {
  .landing-gradient {
    height: 1400px;
    background:
      linear-gradient(to bottom, var(--ui-bg) 70%, transparent) top / 100% 590px
        no-repeat,
      radial-gradient(
        ellipse 65vw 425px at 100% 895px,
        color-mix(in srgb, var(--ui-primary) 20%, transparent),
        color-mix(in srgb, var(--ui-primary) 9.6%, transparent) 46%,
        transparent
      ),
      radial-gradient(
        ellipse 60vw 390px at 125% 880px,
        #14b8a629,
        #14b8a614 46%,
        transparent
      ),
      radial-gradient(
        ellipse 75vw 370px at 105% 1020px,
        #3b82f624,
        #3b82f611 46%,
        transparent
      );
  }
}
@media (max-width: 767px) {
  .landing-gradient {
    height: 1050px;
    background:
      linear-gradient(to bottom, var(--ui-bg) 70%, transparent) top / 100% 490px
        no-repeat,
      radial-gradient(
        ellipse 65vw 270px at 100% 680px,
        color-mix(in srgb, var(--ui-primary) 20%, transparent),
        color-mix(in srgb, var(--ui-primary) 9.6%, transparent) 46%,
        transparent
      ),
      radial-gradient(
        ellipse 60vw 250px at 125% 690px,
        #14b8a629,
        #14b8a614 46%,
        transparent
      ),
      radial-gradient(
        ellipse 75vw 250px at 105% 790px,
        #3b82f624,
        #3b82f611 46%,
        transparent
      );
  }
}
</style>
