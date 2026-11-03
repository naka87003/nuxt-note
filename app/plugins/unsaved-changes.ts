export default defineNuxtPlugin(() => {
  const open = ref(false);
  let pending: ((confirmed: boolean) => void) | undefined;
  function resolve(confirmed: boolean) {
    open.value = false;
    pending?.(confirmed);
    pending = undefined;
  }
  function confirm() {
    // Only one pending navigation can own the confirmation dialog.
    if (pending) return Promise.resolve(false);
    open.value = true;
    return new Promise<boolean>((done) => {
      pending = done;
    });
  }
  return { provide: { unsavedChanges: { open, confirm, resolve } } };
});
