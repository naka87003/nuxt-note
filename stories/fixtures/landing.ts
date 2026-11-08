import "./landing.css";

// Match index.vue's content width and responsive padding.
export const landingDecorators = [
  () => ({ template: '<div class="landing-story"><story /></div>' }),
];

export async function waitForLandingAssets(canvasElement: HTMLElement) {
  await canvasElement.ownerDocument.fonts.ready;
  await Promise.all(
    Array.from(canvasElement.querySelectorAll("img")).map((image) =>
      image.decode(),
    ),
  );
}
