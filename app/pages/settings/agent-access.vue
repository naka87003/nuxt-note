<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: "settings" });
useHead({ title: "Agent access · Nuxt Note" });

const {
  data: tokens,
  status,
  error: loadError,
  refresh,
} = await useFetch("/api/agent-tokens", { server: false });

const requestUrl = useRequestURL();
const endpoint = new URL("/mcp", requestUrl.origin).href;
const name = ref("My agent");
const issued = ref<{ id: string; token: string } | null>(null);
const toast = useToast();
const busy = ref(false);
const failure = ref("");
const deleteId = ref("");
const deleteOpen = computed({
  get: () => Boolean(deleteId.value),
  set: (open) => {
    if (!open) deleteId.value = "";
  },
});

async function issue() {
  if (busy.value || issued.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const result = await $fetch("/api/agent-tokens", {
      method: "POST",
      body: { name: name.value },
    });
    issued.value = { id: result.id, token: result.token };
    await refresh();
  } catch {
    failure.value = "Could not create the token. Please try again.";
  } finally {
    busy.value = false;
  }
}

async function deleteToken() {
  if (busy.value || !deleteId.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/agent-tokens/${deleteId.value}`, { method: "DELETE" });
    if (deleteId.value === issued.value?.id) issued.value = null;
    deleteId.value = "";
    toast.add({ title: "Token deleted", color: "success" });
    await refresh();
  } catch {
    failure.value = "Could not delete the token. Please try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
    <div class="space-y-3">
      <h1 class="text-2xl font-semibold">Agent access</h1>
      <p class="text-muted">
        Let an agent search, read, create, and update your Notes. Tokens cannot
        delete content or access Chat. Tokens have no expiration date and can be
        deleted at any time.
      </p>
    </div>

    <section
      class="space-y-4 rounded-lg border border-default p-5"
      aria-labelledby="connect-heading"
    >
      <h2 id="connect-heading" class="text-lg font-semibold">
        Connect your agent
      </h2>
      <p class="text-muted">
        Only agents that support Streamable HTTP and manually configured Bearer
        tokens can connect. No project download or local MCP program is needed.
      </p>
      <CopyableValue
        :value="endpoint"
        copy-label="Copy URL"
        copied-message="URL copied to clipboard."
      />
      <ol class="list-decimal space-y-2 pl-5 text-sm">
        <li>Create a token below.</li>
        <li>
          In your agent's MCP settings, add the URL above with Streamable HTTP
          transport.
        </li>
        <li>
          Set the Authorization header to
          <code>Bearer &lt;your token&gt;</code>, then reconnect your agent.
        </li>
      </ol>
      <p class="text-sm text-muted">
        Use a client that supports custom Bearer headers. Automatic OAuth
        sign-in is not available yet. Keep the token in the client's private
        settings, never in a URL or chat.
      </p>
      <p class="text-sm">
        Try: “Use nuxt-note to search my Notes about Nuxt, read one, and
        summarize it.”
      </p>
    </section>

    <section
      class="space-y-4 rounded-lg border border-default p-5"
      aria-labelledby="create-token-heading"
    >
      <h2 id="create-token-heading" class="text-lg font-semibold">
        Create an agent token
      </h2>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="issue">
        <UFormField
          label="Token name"
          name="name"
          class="min-w-0 flex-1"
          required
        >
          <UInput
            v-model="name"
            :maxlength="50"
            :disabled="busy || Boolean(issued)"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="busy"
          :disabled="!name.trim() || Boolean(issued)"
        >
          Create token
        </UButton>
      </form>
      <div
        v-if="issued"
        class="space-y-3 rounded-md bg-elevated p-4"
        role="status"
      >
        <p class="font-medium">
          Save this token before hiding it or leaving this page.
        </p>
        <p class="text-sm text-muted">
          You can copy it as many times as needed while it is visible. Once
          hidden, it cannot be shown again. Store it in your agent's private
          settings, never in a chat or version control.
        </p>
        <CopyableValue
          :value="issued.token"
          copy-label="Copy token"
          copied-message="Token copied to clipboard."
        />
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-eye-off"
            class="min-h-11"
            @click="issued = null"
          >
            Hide token
          </UButton>
        </div>
      </div>
      <p v-if="failure" role="alert" class="text-error">{{ failure }}</p>
    </section>

    <section class="space-y-4" aria-labelledby="tokens-heading">
      <h2 id="tokens-heading" class="text-lg font-semibold">Your tokens</h2>
      <p v-if="status === 'pending'" role="status">Loading tokens…</p>
      <div v-else-if="loadError" role="alert">
        <p>Could not load tokens.</p>
        <UButton variant="outline" @click="refresh()">Retry</UButton>
      </div>
      <p v-else-if="!tokens?.length" class="text-muted">No agent tokens yet.</p>
      <ul v-else class="space-y-3">
        <li
          v-for="token in tokens"
          :key="token.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-4"
        >
          <div class="min-w-0">
            <p class="font-medium wrap-anywhere">{{ token.name }}</p>
            <p class="text-sm text-muted">
              Created {{ new Date(token.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <UButton
            color="error"
            variant="outline"
            :disabled="busy"
            :aria-label="`Delete ${token.name}`"
            @click="deleteId = token.id"
          >
            Delete
          </UButton>
        </li>
      </ul>
    </section>

    <UModal
      v-model:open="deleteOpen"
      title="Delete token?"
      description="This permanently deletes the token. Any agent using it will lose access to your Notes. This cannot be undone."
      :dismissible="!busy"
    >
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="deleteId = ''"
        >
          Cancel
        </UButton>
        <UButton color="error" :loading="busy" @click="deleteToken">
          Delete token
        </UButton>
      </template>
    </UModal>
  </div>
</template>
