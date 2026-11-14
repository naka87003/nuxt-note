import { useDebounceFn } from "@vueuse/core";
import { ref, watch, type Ref } from "vue";

export function useWorkspaceListQuery(
  mode: Ref<string>,
  category: Ref<string>,
  search: Ref<string>,
) {
  const query = ref({ category: category.value, q: search.value });
  const update = () => {
    query.value = { category: category.value, q: search.value };
  };
  const debouncedUpdate = useDebounceFn(update, 500);

  watch(
    [mode, category, search],
    ([mode, category, search], [previousMode, previousCategory], onCleanup) => {
      onCleanup(debouncedUpdate.cancel);

      // Clear and context changes apply immediately, including pending input.
      if (!search || mode !== previousMode || category !== previousCategory) {
        update();
        return;
      }

      void debouncedUpdate();
    },
  );

  return query;
}
