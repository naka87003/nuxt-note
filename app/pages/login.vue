<script setup lang="ts">
definePageMeta({ layout: false });
const route = useRoute();
const { loggedIn } = useUserSession();
if (loggedIn.value) await navigateTo("/notes");

const signingIn = ref(false);

async function signIn() {
  if (signingIn.value) return;
  signingIn.value = true;
  try {
    await navigateTo("/auth/github", { external: true });
  } catch (error) {
    signingIn.value = false;
    throw error;
  }
}

// Restore the button when returning from GitHub via the browser's back button.
function resetSignIn() {
  signingIn.value = false;
}
onMounted(() => window.addEventListener("pageshow", resetSignIn));
onBeforeUnmount(() => window.removeEventListener("pageshow", resetSignIn));
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center p-6">
    <div class="absolute top-4 right-4"><ThemePicker /></div>
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
          type="button"
          :loading="signingIn"
          icon="i-lucide-github"
          size="xl"
          block
          class="min-h-12"
          @click="signIn"
        >
          Continue with GitHub
        </UButton>
        <p class="text-dimmed text-sm">
          Your notes are private to your account.
        </p>
      </div>
    </UCard>
  </main>
</template>
