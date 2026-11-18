import type { MaybeRefOrGetter } from "vue";

/**
 * For links whose successful navigation unmounts the calling component.
 * Loading stays active until unmount; avoid use in persistent layouts or
 * navigation that only changes the current page's query or hash.
 */
export function useLinkNavigation(to: MaybeRefOrGetter<string>) {
  const opening = ref<string | null>(null);
  const pending = computed(() => opening.value !== null);

  async function navigate(event: MouseEvent, source = "link") {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (pending.value) return;
    opening.value = source;

    try {
      const failure = await navigateTo(toValue(to));

      // Routing can resolve before the destination's async setup finishes.
      // Keep loading until unmount; only reset on cancellation or failure.
      if (failure !== undefined) opening.value = null;
    } catch (error) {
      opening.value = null;
      throw error;
    }
  }

  return { opening, pending, navigate };
}
