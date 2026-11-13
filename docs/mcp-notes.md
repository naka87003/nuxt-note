# Read, create, update, and delete Notes through MCP

Saved Notes are available through a remote **Streamable HTTP** MCP endpoint at
`/mcp`. Users register the URL and their token in a compatible agent;
no repository clone, Node.js installation, or local MCP program is required.

```text
Agent host → HTTPS /mcp → token verification → owner-scoped Note operations → PostgreSQL
```

The remote endpoint calls the shared server-side Note operations directly.

## Connect remotely

1. Sign in to Nuxt Note and open **Profile menu → Agent access**.
2. Create a token. Every token allows searching, reading, creating, updating, and permanently deleting Notes.
   Use the copy button beside its value.
   You can copy it repeatedly while visible; save it before hiding it or leaving
   the page because it cannot be displayed again.
3. Add the MCP URL shown on the page to an agent that supports **Streamable HTTP
   with custom Bearer headers**. Locally this is `http://localhost:3001/mcp`.
   After deployment it is `https://<your-domain>/mcp`.
4. Set the `Authorization` header to `Bearer <your token>`. The token is a private
   client setting, never a URL parameter or a chat message.
5. Reconnect/reload the agent and try the prompt below.

For Codex, add a server entry containing the URL and token to the private user config
`~/.codex/config.toml`, or the project `.codex/config.toml` if already using a
trusted project. Preserve other settings and replace an existing entry with the
same name rather than adding duplicate tables. Keep the file owner-readable only.
The configuration contains a secret: keep it in private configuration rather than
version control. The following example has placeholders:

```toml
[mcp_servers.nuxt-note]
url = "https://<your-domain>/mcp"
http_headers = { Authorization = "Bearer <YOUR_TOKEN>" }
```

Alternatively use `bearer_token_env_var = "NUXT_NOTE_TOKEN"` if that environment
variable is available to the agent process. A GUI app does not automatically read
this repository's `.env.mcp.local`. No `command` or local script `args` belongs in
this remote server entry. See [OpenAI's MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp).

This endpoint uses manually issued tokens. It does **not** implement OAuth discovery,
authorization, or automatic browser sign-in. Clients that require OAuth and cannot
send a custom Bearer header need additional integration. Native clients typically
send no `Origin` header. Browser clients must use the site's own origin or an
explicitly allowed origin configured in `NUXT_MCP_ALLOWED_ORIGINS`.

## Deploy the endpoint

Deploy the Nuxt application with the SDK and Zod runtime dependencies and the
existing database/session configuration. Apply the committed migrations to the
target database before deploying if not applied already. `NUXT_PUBLIC_SITE_URL` defaults to
`https://nuxt-note-ivory.vercel.app`; no extra setting is needed when using that
domain. Override it only when changing the canonical origin. The Vercel deployment host (`VERCEL_URL`) and
loopback development hosts are also accepted; unrelated Host and Origin headers
are rejected. `NUXT_MCP_ALLOWED_ORIGINS` is an optional comma-separated list of
exact extra browser origins, not a wildcard CORS setting.

AgentToken is included in the unified `20261103000000_init` migration, with no
scopes, expiration, or revocation columns. See [database initialization](development.md#database-initialization)
for new-database setup and routine migration commands.

The handler creates a fresh MCP instance per authenticated request and stores no
user sessions in memory. It serves current SDK requests and a stateless fallback
for 2025-era MCP clients. Modern responses are JSON; legacy responses may use a
finite SSE exchange. There is no persistent GET stream, HTTP session ID, or tool
subscription support. GET and DELETE return 405. Every POST, including discovery,
requires a valid token; a browser session cookie alone is not sufficient.
Requests are limited to 64 KiB and responses use `private, no-store` even for legacy
SSE. Invalid or deleted tokens receive HTTP 401. Tool errors hide database
details.

Verify URL/authentication, owner isolation, search/reading, and token deletion on the
hosted deployment before treating it as validated in production. Local checks do
not establish hosting behavior. This implementation does not deploy itself.

## Try it

After reloading the agent app, ask:

> Use the nuxt-note MCP server's list_notes tool to find Notes about Nuxt.
> Use get_note to read one matching Note and summarize it. Do not use shell
> commands or repository files to obtain the Note.

Check the activity for actual tool calls. No token should appear in tool arguments
or results.

For a read-only remote terminal check, run `pnpm check:mcp:remote` with Nuxt
running and `.env.mcp.local` configured from `.env.mcp.example` (or set
`NUXT_NOTE_URL` and `NUXT_NOTE_TOKEN` in the process environment). This developer
check discovers the available tools and reads one Note, without printing its contents.
Ordinary users only configure their agent and do not need this repository or file.

| Tool          | Arguments                                                              | Result                                                               |
| ------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `list_notes`  | Optional `q`, `category`, `limit`, `offset`                            | IDs, titles, category IDs, update times, text previews, `nextOffset` |
| `get_note`    | `id` from a search result                                              | ID, title, Markdown, category ID, creation/update times              |
| `create_note` | Required `title`, `markdown`; optional `categoryId`                    | ID, title, Markdown, category ID, creation/update times, URL         |
| `update_note` | Required `id`, `title`, `markdown`, `updatedAt`; optional `categoryId` | Updated Note with creation/update times and URL                      |
| `delete_note` | Required `id`, `updatedAt`                                             | Deleted Note ID and `deleted: true`                                  |

Search is literal and case-insensitive across title and Markdown body, with the
same 50-character search limit as the UI. `%`, `_`, and backslashes are literal.
`category` accepts a category ID, `all`, or `uncategorized`. Default page size is
20, maximum 50. Pass `nextOffset` back as `offset` until it is null. Concurrent
edits may move Notes between pages; this is a bounded offset listing, not a snapshot.

`create_note` is available to every valid token. It accepts a title of at
most 50 UTF-16 code units and a Markdown body of at most 5,000, matching the UI.
Both strings are required; empty content is allowed. Titles are trimmed and a
blank title becomes `Untitled note`. Omit `categoryId` or pass null for an
uncategorized Note; otherwise use an existing category ID belonging to the token
owner (for example from `list_notes`). Missing and foreign categories return the
same error without creating a Note. Extra fields, including `userId` and `id`,
are rejected. Ownership comes only from the authenticated token.

Creation and updating also return `url`, an absolute browser link built from
`NUXT_PUBLIC_SITE_URL` and `/notes/<id>`. The tool description asks the agent to
present the saved title as a clickable link. Opening it requires the owner's
normal browser sign-in; the URL contains no token and does not make the Note public.
For links to open a local development app, set `NUXT_PUBLIC_SITE_URL` to that
app's origin.

Creation is non-idempotent: repeating a successful call creates another Note.
The tool is annotated as a non-read-only, non-destructive, non-idempotent action.
Ask the agent to save a new Note explicitly, then use `get_note` on the returned
ID to verify it. Creating categories is not exposed.

## Update an existing Note

`update_note` is available to every valid token. First call `get_note`, then pass
its `id` and exact `updatedAt` (UTC ISO timestamp with milliseconds), together with
the complete replacement `title` and `markdown`. Content limits and title
normalization match `create_note`. Omit `categoryId` to keep the current category,
pass null to remove it, or pass an existing category ID owned by the token owner.
Extra fields, including `userId`, are rejected. Missing and foreign Notes or
categories return the same error without exposing ownership or content.

The update checks `id`, token owner, and `updatedAt` atomically in the database.
A stale timestamp fails without modifying the Note. The tool returns a conflict
error instructing the agent to call `get_note` again and reconcile the latest
content with the requested changes. Do not blindly replace the timestamp and
retry. Successful updates return the saved Note, a new `updatedAt`, and `url`;
present the saved title as a clickable link. No database migration is required.

The tool is annotated as non-read-only, destructive (it replaces content), and
non-idempotent (retrying a successful request with its old timestamp conflicts).
This guard applies to MCP updates, including detecting intervening browser edits.
The browser editor's save behavior is unchanged and does not itself reject stale
browser saves.

## Delete an existing Note

`delete_note` is available to every valid token, including previously issued tokens.
It permanently deletes one Note; there is no trash, undo, or deleted-Note history.
Categories, Chats, and other Notes are unaffected. Use it only when the user
explicitly requests deleting the identified Note; clarify ambiguous targets first.
An explicit deletion request does not require an additional confirmation step.
These instructions guide the agent; the server does not enforce a two-step confirmation.

First call `get_note`, then pass its `id` and exact `updatedAt` (UTC ISO timestamp
with milliseconds). Both fields are required and extra fields, including `userId`,
are rejected. The database deletes only when `id`, token owner, and `updatedAt`
match atomically. No database migration is required. Browser deletion is unchanged.

A changed Note returns a conflict error without deleting it. Read it again and
ask the user to confirm deletion of the changed Note before retrying with the new
`updatedAt`. Never automatically replace the timestamp and retry. Missing, foreign,
and already-deleted Notes all return the same `Note not found` error without
exposing ownership or content. Errors use MCP `isError: true`, as with updates.

Success returns `{ "id": "<deleted-note-id>", "deleted": true }` without the
Note body or a URL. Repeating a successful call returns `Note not found`. The tool
is annotated as non-read-only, destructive, and idempotent because repeating the
same request has no additional effect on stored data, even though its response differs.

## Authentication and deletion

Each token has 256 bits of randomness, no expiration date, and access to only
its issuing user's Notes for searching, reading, creation, updates, and permanent deletion. The database stores its SHA-256 hash and metadata,
not the raw token. Token lists never return either the secret or hash. Token creation
and token deletion require the browser login session. Bearer tokens do not authorize
those operations, browser Note API routes, or Chat endpoints.

There are no per-token scopes or permission choices. All valid tokens, including
previously issued read-only tokens, can now create, update, and permanently delete Notes. Their secret remains unchanged; no token replacement or client
configuration change is required. Reconnect the agent to refresh its tool list.

Every MCP request checks that the token hash exists and derives
the owner ID from the token record. Caller-supplied user IDs are ignored. Reading
another user's Note returns the same 404 as reading a missing Note. Responses use
`Cache-Control: private, no-store`.

Delete a token from **Agent access → Delete** to permanently remove its database
record and reject subsequent requests, even without reconnecting the agent.
The confirmation dialog explains that deletion cannot be undone. After deletion,
the token disappears from the list and a completion notification is shown.
An operation already in flight may finish. Already retrieved text remains in the
agent's context. Issue a new token and update the agent's private connection
settings when replacing a deleted token. No deleted-token history is retained.

## Code map

- [`server/utils/agent-auth.ts`](../server/utils/agent-auth.ts): generation,
  hashing, token lookup, and token metadata selection.
- [`server/utils/note-reads.ts`](../server/utils/note-reads.ts): owner-scoped
  reads shared by browser routes and MCP tools.
- [`server/utils/note-writes.ts`](../server/utils/note-writes.ts): validated,
  owner-scoped creation shared by the browser route and MCP, and atomic
  version-checked MCP updates and deletions.
- [`server/routes/mcp.ts`](../server/routes/mcp.ts): authenticated Streamable HTTP entry.
- [`server/utils/mcp-notes.ts`](../server/utils/mcp-notes.ts): request-scoped MCP tools.
- [`server/utils/mcp-http.ts`](../server/utils/mcp-http.ts): Host and Origin checks.
- `server/api/agent-tokens/`: browser-session token management.
- [`app/pages/settings/agent-access.vue`](../app/pages/settings/agent-access.vue):
  one-time secret display, repeatable value copying, and confirmed deletion.

## Verification

```bash
pnpm test --project unit
pnpm lint
pnpm typecheck
pnpm build
```

The real database integration check is explicitly opt-in:

```bash
pnpm test:agent --live
```

It loads `.env` and uses the configured database. Build and apply any pending
migrations before running it. It starts a separate local app process with a temporary session
secret, uses the existing user with the most Notes, and creates two verification
Notes, one temporary second user/Note, and tokens. It tests session-only token
management, stored hashes, searching/pagination, owner isolation,
physical token deletion, remote HTTP MCP calls, creation/readback,
updates/readback, concurrent update conflict detection, update owner isolation,
version-checked deletion, deletion conflicts and owner isolation, concurrent deletion,
category ownership, creation denial after deletion, concurrent user isolation,
legacy initialization, malformed/oversized requests, and HTTP boundary checks. It removes only records identified by that
run's random marker/IDs in `finally`. Existing Notes are neither edited nor deleted, and their content is not printed. An interrupted process may require cleaning up its verification records.

This check runs no AI requests and does not register an agent host or deploy the
application. Local development may use a hosted database: choosing localhost as
the app URL does not make the database local. Production deployment remains a
separate release step, including applying any pending migrations to that target.
