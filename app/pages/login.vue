<script setup lang="ts">
definePageMeta({ layout: false });
const route = useRoute();
const { loggedIn } = useUserSession();
if (loggedIn.value) await navigateTo("/notes");
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center p-6">
    <UCard class="w-full max-w-md">
      <div class="flex flex-col items-center gap-6 py-4 text-center">
        <NuxtLink to="/" aria-label="Nuxt Note home"><AppBrand /></NuxtLink>
        <h1 class="text-2xl font-bold">Your ideas, in one place.</h1>
        <p class="text-dimmed">
          Sign in with GitHub to open your personal notebook.
        </p>
        <UAlert
          v-if="route.query.error === 'github'"
          color="error"
          variant="soft"
          title="Sign-in could not be completed."
          description="Please try again. If this continues, check the OAuth and database configuration."
        />
        <UButton
          to="/auth/github"
          external
          icon="i-lucide-github"
          size="xl"
          block
          class="min-h-12"
          >Continue with GitHub</UButton
        >
        <p class="text-dimmed text-sm">
          Your notes are private to your account.
        </p>
      </div>
    </UCard>
  </main>
</template>
