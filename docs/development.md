# Development and Environment Setup

## Requirements

- Node.js 26.11.1 / pnpm 12.16.1
- PostgreSQL, using the existing Nuxt Note database or a local development database
- A GitHub OAuth App

Nuxt Note is the development target for a single application containing notes and chat. Its existing GitHub OAuth App and PostgreSQL database will serve both features. Keep development and production environments separate. The original nuxt-chat database and OAuth configuration remain untouched; no Chat data import is planned. See the [integration plan](integration.md).

## GitHub OAuth App

Create a development app in GitHub under Settings → Developer settings → OAuth Apps.

| Field                      | Value                             |
| -------------------------- | --------------------------------- |
| Application name           | Nuxt Note Local                   |
| Homepage URL               | http://localhost:3001             |
| Authorization callback URL | http://localhost:3001/auth/github |

Set the Client ID and Client Secret in `.env` as `NUXT_OAUTH_GITHUB_CLIENT_ID` and `NUXT_OAUTH_GITHUB_CLIENT_SECRET`. Sign-in does not depend on whether the GitHub user's email address is public.

The callback URL is inferred from the request to `/auth/github`, so `NUXT_OAUTH_GITHUB_REDIRECT_URL` is normally unnecessary. Set it only when the public callback URL needs an explicit override, for example if a reverse proxy prevents correct URL detection. The GitHub OAuth App must still have the matching Authorization callback URL configured.

## PostgreSQL / Supabase

Supabase is used only as PostgreSQL. Supabase Auth's GitHub provider, an anon key, and a service-role key are not required.

Copy a connection URI from Connect into `.env`. For local development, the Session pooler on port 5432 can be used for both `DATABASE_URL` and `DIRECT_URL`. If using a direct connection, verify that the local network can reach its IPv6 endpoint. Do not use the Transaction pooler on port 6543 for CLI migrations.

- `DATABASE_URL`: the Nuxt server's runtime connection.
- `DIRECT_URL`: the Prisma CLI connection. Falls back to DATABASE_URL if omitted.
- URI-encode passwords containing special characters.
- This foundation targets a long-running Node server. Review connection limits and pooling if deploying to a serverless environment.

Keep secrets in `.env`, not in chat messages or Git. Do not log connection strings.

References: [Supabase / Prisma](https://supabase.com/docs/guides/database/prisma), [PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Sessions

Set `NUXT_APP_SECRET` in `.env` to a random value of at least 32 characters before starting development. Nuxt supports automatic secret generation during development, but an explicit value avoids missing-secret errors in the local session flow. Generate one with the command below, replace the empty value in `.env`, and restart `pnpm dev`. Production also requires an explicit secret; use a different value there.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Database initialization

For an existing configured database, first consult the [deployment audit](deployment.md#status-and-scope). The 2026-11-03 read-only inspection found the current init applied with a matching checksum on the local environment's target. The older-init guidance below applies only to targets with an older schema/history; it is not an instruction to reset this inspected database.

Before running these commands, verify that `.env` points to an empty Nuxt Note database. The unified initial migration creates the complete Note and Chat foundation.

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

`db:migrate` applies the SQL committed to this repository. It does not create a shadow database on Supabase. RLS is enabled on User, Category, Note, Chat and Message to prevent anonymous access through the Data API. The database role used by the Prisma server connection must have the required database permissions.

The rewritten `20261103000000_init` creates User, Category, Note, Chat, Message, MessageRole, and RLS on all five tables. Notes and conversations share Category; there is no Project table. It imports no data. This version has not been applied to Supabase by this change.

Current Note data is disposable, so the initial schema has been consolidated before further development. A database that applied the old Note-only or six-table Project init must be reset or replaced with a fresh empty database, including a fresh Prisma migration history, before deploying this init. Simply running `pnpm db:migrate` against the old database will not replay an already-applied init. Resetting removes existing users, notes, and categories; sign in again afterward to create a user. No reset is performed by this change. Do not copy Chat migration records, manually mark the new init as applied to an old schema, or reset a shared Supabase database schema. Verify that the target is dedicated and obtain explicit authorization before resetting it. Future schema changes should use new migrations once this init has been adopted. Installation and builds never apply migrations automatically.

The unified session uses `user.id` for the Note database User.id. The GitHub identity is stored as User.githubId in the database. Imported Chat code must use the database ID from `session.user.id`, replacing the original Chat session's `databaseUserId` convention. One login and sign-out flow covers both features; no cross-application session sharing is planned.

Server APIs use `getAuthenticatedUserId` from `server/utils/auth.ts`. It requires a valid session and a database UUID in `user.id`, rejects missing or legacy numeric IDs with 401, and does not fall back to `databaseUserId`. Ownership filters remain necessary on every database query.

## Disposable database verification

Run `pnpm test:db` with a running Docker engine. The script uses the official `postgres:17-alpine` image, creating a unique temporary container with no network access or published ports. The first run may download the image. It never loads `.env` or uses the application's connection strings.

The check applies the unified init to an empty database and inserts representative Note fixtures. It checks shared category membership and rename, category-name uniqueness per owner, category deletion uncategorizing both notes and chats without losing messages, initially empty Chat tables, orphan rejection, RLS, and owner deletion isolation. It stops the container and removes its temporary storage when complete. These are direct SQL checks; they do not exercise Prisma's deployment history or live OAuth.

`pnpm test` separately checks authentication and Note API ownership using mocked sessions and database calls. Real GitHub sign-in and authenticated Note saving must be smoke-tested separately after running the app. Chat API ownership, generation lifecycle, retry and safe Markdown are covered by unit tests. `pnpm test:chat` checks the built server against a disposable database and mock AI, including Note update/category/delete ownership checks; real OAuth remains a separate manual check.

## Running and verifying the app

```bash
pnpm dev
```

1. Open http://localhost:3001 and verify the landing page.
2. Use the start button to sign in with GitHub.
3. Verify that `/notes` opens and the avatar and user name are displayed.
4. Create a test note, save it, edit its title/body/category, and check Edit / Split view / Preview. Confirm that Cancel/Back with unsaved edits offers Keep editing / Discard changes. Use only a disposable test note for the confirmed-deletion check.
5. Verify desktop/medium/mobile layouts, bounded Markdown scrolling and draft preservation while resizing. New/saved notes use the same editor; Title and Category share a row from 768px and stack below it.
6. Create a test Chat and check send, stop/partial save and manual retry. Confirm that shared categories appear in both workspaces.
7. Verify that Sign out works from the avatar menu, including unsaved-note confirmation.
8. After signing out, verify that opening `/notes` directly redirects to `/login`.

`/api/health` reports only that the app is running; it does not confirm a database connection. Verify authentication and the actual database connection separately using the steps above after configuring credentials.

## OpenAI connection

Set `NUXT_OPENAI_API_KEY` in the ignored `.env` or the deployment's secret store. The user authorized sharing the existing nuxt-chat key. `NUXT_OPENAI_MODEL` defaults to `gpt-6.1-sol`; change it server-side when needed. No new OAuth or Supabase API keys are required. These settings are private runtime configuration; never place the key in `runtimeConfig.public`, browser storage, logs, or commits. Restart the server after changing local settings.

The first send saves the chat/question and then requests an answer. Missing AI configuration yields a retryable message without discarding the question. Provider/model access or quota failures also preserve the question. Shared-key requests use the same provider project limits and budget; no automatic paid retries or title-generation requests are made. Stop/failed partial answers remain saved. Application-level retention in OpenAI is disabled with `store: false`; this does not promise zero provider retention. See [OpenAI authentication](https://developers.openai.com/api/reference/overview#authentication), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [data controls](https://developers.openai.com/api/docs/guides/your-data), and [AI SDK cancellation](https://ai-sdk.dev/docs/advanced/stopping-streams).

Generation uses a 120-second server timeout and 4,096 output-token cap. The initial target remains a long-running Node server; verify the eventual host's streaming, proxy buffering and request-duration settings before deployment. There is no stream resumption or durable background worker.

Vercel is now the intended deployment platform. The [deployment preparation guide](deployment.md) covers serverless pooling, function duration, environment separation and hosted-streaming checks. No hosting configuration has been applied yet.

After `pnpm build`, run `pnpm test:chat` with Docker available. It never loads `.env`, uses a random session secret, starts a dedicated temporary PostgreSQL container and local built server, intercepts OpenAI requests with a test provider, and removes the container on completion. It does not exercise live OAuth or spend API credits. `pnpm test:chat --preview` keeps a loopback-only authenticated fixture at `http://127.0.0.1:3012/chats/new` until Ctrl+C for UI checks. This test proxy is never included in the application build.
