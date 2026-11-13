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
const issued = ref("");
const busy = ref(false);
const failure = ref("");
const endpointCopied = ref(false);
const revokeId = ref("");
const revokeOpen = computed({
  get: () => Boolean(revokeId.value),
  set: (open) => {
    if (!open) revokeId.value = "";
  },
});

function tokenStatus(token: { revokedAt: string | null; expiresAt: string }) {
  if (token.revokedAt) return "Revoked";
  return new Date(token.expiresAt).getTime() <= Date.now()
    ? "Expired"
    : "Active";
}

async function issue() {
  if (busy.value || issued.value) return;
  busy.value = true;
  failure.value = "";
  try {
    const result = await $fetch("/api/agent-tokens", {
      method: "POST",
      body: { name: name.value },
    });
    issued.value = result.token;
    endpointCopied.value = false;
    await refresh();
  } catch {
    failure.value = "Could not create the token. Please try again.";
  } finally {
    busy.value = false;
  }
}

async function copyEndpoint() {
  try {
    await navigator.clipboard.writeText(endpoint);
    endpointCopied.value = true;
  } catch {
    failure.value = "Could not copy. Select and copy the URL manually.";
  }
}

async function revoke() {
  if (busy.value || !revokeId.value) return;
  busy.value = true;
  failure.value = "";
  try {
    await $fetch(`/api/agent-tokens/${revokeId.value}`, { method: "DELETE" });
    revokeId.value = "";
    await refresh();
  } catch {
    failure.value = "Could not revoke the token. Please try again.";
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
        Let an agent search, read, and create your Notes. Tokens cannot edit or
        delete content, or access Chat. Tokens expire after 90 days and can be
        revoked at any time.
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
      <div class="flex flex-wrap items-center gap-3">
        <code class="min-w-0 select-all break-all text-sm">{{ endpoint }}</code>
        <UButton variant="outline" @click="copyEndpoint">
          {{ endpointCopied ? "Copied" : "Copy URL" }}
        </UButton>
      </div>
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
          :value="issued"
          copy-label="Copy token"
          copied-message="Token copied to clipboard."
        />
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-eye-off"
            class="min-h-11"
            @click="issued = ''"
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
              {{ tokenStatus(token) }} · Expires
              {{ new Date(token.expiresAt).toLocaleDateString() }}
            </p>
          </div>
          <UButton
            v-if="tokenStatus(token) === 'Active'"
            color="error"
            variant="outline"
            :disabled="busy"
            :aria-label="`Revoke ${token.name}`"
            @click="revokeId = token.id"
          >
            Revoke
          </UButton>
        </li>
      </ul>
    </section>

    <UModal
      v-model:open="revokeOpen"
      title="Revoke token?"
      description="Any agent using this token will lose access to your Notes."
      :dismissible="!busy"
    >
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="revokeId = ''"
        >
          Cancel
        </UButton>
        <UButton color="error" :loading="busy" @click="revoke">
          Revoke token
        </UButton>
      </template>
    </UModal>
  </div>
</template>
