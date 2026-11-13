# Read, create, update, and delete Notes through MCP

Saved Notes are available through a remote **Streamable HTTP** MCP endpoint at
`/mcp`. Users register the URL and their token in a compatible agent;
no repository clone, Node.js installation, or local MCP program is required.

```text
Agent host → HTTPS /mcp → token verification → owner-scoped Note operations → PostgreSQL
```

The remote endpoint calls the shared server-side Note operations directly.

## Use Notes from the in-app Chat

The signed-in app Chat can use the same six tools for Notes and existing Categories automatically. Ask it to
search and summarize saved Notes, save new content, edit an existing Note, or
permanently delete an identified Note. No Agent access token or MCP client setup
is required: Chat uses the browser login session and the same owner-scoped Note
operations and tool schemas as the remote MCP endpoint.

When creating a Note, Chat uses the user’s explicit Category choice first
(including uncategorized), then the Chat’s Category, then an existing Category
that clearly matches the content. It uses `list_categories` to discover IDs and
names, including Categories with no Notes. Without a match, the Note is
uncategorized; an explicitly requested missing Category also falls back to
uncategorized. The “organize into a Note” draft uses the same priority.
Category creation, editing, and deletion are not exposed through Chat or MCP.
Remote agents receive the same selection guidance in `create_note`; any current
chat Category must come from their own context, since MCP has no app Chat session.

Examples:

- “Find my Notes about Nuxt and summarize them.”
- “Save this explanation as a new Note.”
- “Add this example to my Nuxt Note.”
- “Delete the Note titled Old draft.”

Chat can read an existing Note directly from its link in the conversation,
including a link returned when the Note was created. The Chat `get_note` tool
accepts a Note ID, a same-site absolute Note URL, or a `/notes/<id>` path. Links
are resolved locally to IDs; the tool never fetches external URLs. The remote MCP
`get_note` input remains a Note ID.

Chat reads the exact Note version before updating or deleting it. Concurrent
changes prevent the write; a deletion conflict requires a new user confirmation
message. Successful creates and updates return a clickable Note link.

Tool execution is bounded to eight model steps, with the final step reserved for
an answer, and shares Chat's existing 120-second timeout. Leaving the Chat stops
new tool executions; a database operation already in flight may still finish.
After an interrupted response, **Try again** provides only search/read tools so
that it cannot repeat a write whose acknowledgement was lost. It checks current
Notes and asks for a new message if further changes are needed. Tool call history
is not stored separately from the assistant's text, so Chat must verify current
state rather than infer successful writes from an interrupted response.

## Connect remotely

Open **Profile menu → Agent access** for the connection URL, token creation,
and setup instructions, including a copyable Codex configuration example.
No repository clone or local MCP process is required.

The endpoint is `/mcp` on the application's origin and requires **Streamable HTTP
with a custom `Authorization: Bearer <token>` header**. Keep tokens in private
client settings, never in URLs, chat messages, or version control. Tokens can only
be copied while visible after issuance; they cannot be displayed again later.

The endpoint does not implement OAuth discovery or authorization. Clients that
require OAuth and cannot send a custom Bearer header need additional integration.
Native clients typically send no `Origin` header. Browser clients must use the
site's own origin or an origin allowed by `NUXT_MCP_ALLOWED_ORIGINS`.

## Deploy the endpoint

Deploy the Nuxt application with its database/session configuration and apply
pending migrations through the [deployment procedure](deployment.md).
The [domain configuration](deployment.md#domain-and-mcp-configuration) defines
`public.siteUrl`, optional browser origins, and accepted hosts. Leave
`NUXT_PUBLIC_SITE_URL` and `NUXT_MCP_ALLOWED_ORIGINS` unset for the current
production domain and native clients such as Codex. The site origin is
`https://nuxt-note.com`; the MCP client URL is `https://nuxt-note.com/mcp`.

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
not establish hosting behavior.

## Verify the connection

After reconnecting the agent, try the example prompt on the Agent access page.
Have at least one saved Note available. Check the activity for actual MCP tool
calls; no token should appear in tool arguments or results.

For a read-only remote terminal check, run `pnpm check:mcp:remote` with Nuxt
running and `.env.mcp.local` configured from `.env.mcp.example` (or set
`NUXT_NOTE_URL` and `NUXT_NOTE_TOKEN` in the process environment). This developer
check discovers the available tools and reads one Note, without printing its contents.
Ordinary users only configure their agent and do not need this repository or file.

| Tool              | Arguments                                                              | Result                                                               |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `list_categories` | No arguments                                                           | All existing Category IDs and names, including empty Categories      |
| `list_notes`      | Optional `q`, `category`, `limit`, `offset`                            | IDs, titles, category IDs, update times, text previews, `nextOffset` |
| `get_note`        | `id` from a search result                                              | ID, title, Markdown, category ID, creation/update times              |
| `create_note`     | Required `title`, `markdown`; optional `categoryId`                    | ID, title, Markdown, category ID, creation/update times, URL         |
| `update_note`     | Required `id`, `title`, `markdown`, `updatedAt`; optional `categoryId` | Updated Note with creation/update times and URL                      |
| `delete_note`     | Required `id`, `updatedAt`                                             | Deleted Note ID and `deleted: true`                                  |

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
owner (from `list_categories`). Missing and foreign categories return the
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
present the saved title as a clickable link.

The tool is annotated as non-read-only, destructive (it replaces content), and
non-idempotent (retrying a successful request with its old timestamp conflicts).
This guard applies to MCP updates, including detecting intervening browser edits.
The browser editor does not itself reject stale browser saves.

## Delete an existing Note

`delete_note` is available to every valid token.
It permanently deletes one Note; there is no trash, undo, or deleted-Note history.
Categories, Chats, and other Notes are unaffected. Use it only when the user
explicitly requests deleting the identified Note; clarify ambiguous targets first.
An explicit deletion request does not require an additional confirmation step.
These instructions guide the agent; the server does not enforce a two-step confirmation.

First call `get_note`, then pass its `id` and exact `updatedAt` (UTC ISO timestamp
with milliseconds). Both fields are required and extra fields, including `userId`,
are rejected. The database deletes only when `id`, token owner, and `updatedAt`
match atomically.

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

There are no per-token scopes or permission choices. Every valid token grants
search, read, create, update, and permanent delete access to its owner's Notes.
Reconnect the agent after tool changes to refresh its tool list.

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

## Verification

Use the [test guide](../tests/README.md) for standard unit, Nuxt, and disposable
integration checks. The commands below are opt-in and have different side effects.

### Live AI with fake Notes

```bash
NUXT_NOTE_LIVE_AI=1 pnpm test --project unit tests/unit/server/utils/chat-tools.live.test.ts
```

Loads `.env` for the API key and optional model and makes billable AI requests.
Notes are mocked; no database is accessed. This test is skipped in the normal suite
and does not verify production or a real database.

### Real database integration

```bash
pnpm test:agent --live
```

Build the app and apply pending migrations first. This check loads `.env`, uses
the configured database and an existing user, and creates verification Notes,
a temporary second user, and tokens. It exercises authenticated MCP operations,
owner isolation, version conflicts, token deletion, and HTTP boundaries without AI
requests. The app process is local; the database may still be hosted or production.

Only records identified by the run's random marker/IDs are removed in `finally`.
Existing Notes are not edited or deleted and their content is not printed.
An interrupted run may require cleanup of its verification records. This command
does not deploy the app or register an agent connection.
