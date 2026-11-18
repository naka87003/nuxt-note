import { neutralColors, primaryColors } from "./theme";

// Runs in the head before first paint, without waiting for Nuxt to start.
// Keep the allowlists shared with the plugin that restores appConfig.
// Depends on Nuxt UI's generated style ID and CSS declaration format below.
// Verify both against its runtime/plugins/colors.js when upgrading @nuxt/ui.
export const themeInitScript = `(() => {
  const allowed = ${JSON.stringify({ primary: primaryColors, neutral: neutralColors })};
  const saved = {};
  for (const key of Object.keys(allowed)) {
    try {
      const cookie = document.cookie.split('; ').find(value => value.startsWith('nuxt-note-' + key + '='));
      if (!cookie) continue;
      const decoded = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
      let value;
      try { value = JSON.parse(decoded); } catch { value = decoded; }
      if (allowed[key].includes(value)) saved[key] = value;
    } catch {}
  }
  if (!Object.keys(saved).length) return;
  const apply = (style) => {
    style.textContent = style.textContent.replace(
      /(--ui-color-(primary|neutral)-\\d{2,3}:\\s*var\\(--color-)[\\w-]+?(-\\d{2,3}[,)])/g,
      (match, start, key, end) => saved[key]
        ? start + (saved[key] === 'neutral' ? 'old-neutral' : saved[key]) + end
        : match
    );
  };
  const style = document.getElementById('nuxt-ui-colors');
  if (style) {
    apply(style);
  } else {
    // Head sorting can place this script before Nuxt UI's style. Observe its
    // insertion so the saved colors still apply before the browser paints.
    const observer = new MutationObserver(() => {
      const style = document.getElementById('nuxt-ui-colors');
      if (!style) return;
      apply(style);
      observer.disconnect();
    });
    observer.observe(document.head, { childList: true });
  }
})();`;
