import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent } from "vue";

// Run composables with the app context and actual Vue mount/unmount hooks.
export async function mountComposable<T>(
  factory: () => T,
  route: string | false = false,
) {
  let result!: T;
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        result = factory();
        return () => null;
      },
    }),
    { route },
  );
  return { result, unmount: () => wrapper.unmount() };
}
