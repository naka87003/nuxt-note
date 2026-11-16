import { useEventListener } from "@vueuse/core";
import { onMounted, type Ref } from "vue";

export function useWorkspaceViewport(root: Readonly<Ref<HTMLElement | null>>) {
  onMounted(() => {
    const viewport = window.visualViewport;

    const fitKeyboard = () => {
      // Let pinch zoom pan naturally instead of resizing the app around it.
      if (!root.value || (viewport && viewport.scale !== 1)) return;
      // iOS can pan the visual viewport after focusing an input, independently
      // of resizing it. Keep both edges of the workspace inside the visible area.
      root.value.style.top = `${viewport?.offsetTop ?? 0}px`;
      root.value.style.height = `${viewport?.height ?? window.innerHeight}px`;
    };

    fitKeyboard();
    if (viewport) useEventListener(viewport, ["resize", "scroll"], fitKeyboard);
  });
}
