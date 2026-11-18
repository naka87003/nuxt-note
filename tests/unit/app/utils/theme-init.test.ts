import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { themeInitScript } from "~/utils/theme-init";

function applyTheme(cookie: string) {
  const style = {
    textContent: `@layer theme { :root {
      --ui-color-primary-50: var(--color-green-50, #effdf5);
      --ui-color-primary-500: var(--color-green-500, #00c16a);
      --ui-color-neutral-950: var(--color-gray-950, #030712);
      --ui-color-success-500: var(--color-green-500, #00c16a);
    } }`,
  };

  runInNewContext(themeInitScript, {
    document: {
      cookie,
      getElementById: (id: string) => (id === "nuxt-ui-colors" ? style : null),
    },
  });

  return style.textContent;
}

it("restores encoded Cookie colors before Nuxt starts, including the neutral palette alias", () => {
  const css = applyTheme(
    "nuxt-note-primary=%22violet%22; nuxt-note-neutral=%22neutral%22",
  );

  expect(css).toContain("--ui-color-primary-50: var(--color-violet-50,");
  expect(css).toContain("--ui-color-primary-500: var(--color-violet-500,");
  expect(css).toContain("--ui-color-neutral-950: var(--color-old-neutral-950,");
  expect(css).toContain("--ui-color-success-500: var(--color-green-500,");
});

it("preserves defaults for missing, malformed, or unapproved Cookie values", () => {
  const defaults = applyTheme("");
  expect(applyTheme("nuxt-note-primary=%E0%A4%A")).toBe(defaults);
  expect(applyTheme("nuxt-note-primary=%22invalid%22")).toBe(defaults);
  expect(applyTheme("nuxt-note-primary=%7B%7D")).toBe(defaults);
  expect(
    applyTheme("nuxt-note-primary=red; nuxt-note-neutral=%E0%A4%A"),
  ).toContain("--ui-color-primary-500: var(--color-red-500,");
});

it("restores colors when head sorting places the colors style after the script", () => {
  let style: { textContent: string } | null = null;

  let notify = () => {};

  const disconnect = vi.fn();
  const observe = vi.fn();

  runInNewContext(themeInitScript, {
    document: {
      cookie: "nuxt-note-primary=%22blue%22",
      head: {},
      getElementById: () => style,
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  });

  expect(observe).toHaveBeenCalledWith({}, { childList: true });
  notify();
  expect(disconnect).not.toHaveBeenCalled();

  style = {
    textContent: "--ui-color-primary-500: var(--color-green-500, #00c16a);",
  };
  notify();
  expect(style.textContent).toContain("var(--color-blue-500,");
  expect(disconnect).toHaveBeenCalledOnce();
});
