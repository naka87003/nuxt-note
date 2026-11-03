<script setup lang="ts">
const { confirmEdits } = useWorkspace();
const { user, clear } = useUserSession();

const items = computed(() => [
  { label: user.value?.name ?? "GitHub user", type: "label" as const },
  { type: "separator" as const },
  { label: "Sign out", icon: "i-lucide-log-out", onSelect: signOut },
]);

async function signOut() {
  if (!(await confirmEdits())) return;
  await clear();
  clearNuxtData();
  await navigateTo("/login");
  clearNuxtState("workspace");
}
</script>

<template>
  <UDropdownMenu :items="items">
    <button
      type="button"
      class="flex min-h-11 min-w-11 items-center justify-center rounded-md"
      aria-label="Open profile menu"
    >
      <UAvatar
        :src="user?.avatarUrl"
        :alt="user?.name ?? 'GitHub user'"
        size="sm"
      />
    </button>
  </UDropdownMenu>
</template>
