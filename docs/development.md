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

The single `20261103000000_init` migration creates User, Category, Note, Chat,
Message, AgentToken, the MessageRole enum, indexes, foreign keys, the Message
status CHECK constraint, and RLS on all six application tables. Tokens have no
scopes, expiration, or revocation columns. No data is imported or seeded.

For a new empty database:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

`db:migrate` applies committed SQL without a shadow database. Installation and
builds do not apply migrations automatically. The database role used by Prisma
must have the required permissions; RLS does not replace server ownership checks.

For an existing database, use `pnpm exec prisma migrate status` to check the
applied history, then `pnpm db:migrate` to apply any new migrations. Do not replay
the init or reset a populated database. Add new migrations for subsequent schema
changes rather than editing the applied init or deleting migration history.

The unified session uses `user.id` for the Note database User.id. The GitHub identity is stored as User.githubId in the database. Imported Chat code must use the database ID from `session.user.id`, replacing the original Chat session's `databaseUserId` convention. One login and sign-out flow covers both features; no cross-application session sharing is planned.

Server APIs use `getAuthenticatedUserId` from `server/utils/auth.ts`. It requires a valid session and a database UUID in `user.id`, rejects missing or legacy numeric IDs with 401, and does not fall back to `databaseUserId`. Ownership filters remain necessary on every database query.

## Disposable database verification

Run `pnpm test:db` with a running Docker engine. The script uses the official `postgres:17-alpine` image, creating a unique temporary container with no network access or published ports. The first run may download the image. It never loads `.env` or uses the application's connection strings.

The check applies the unified init to an empty database and inserts representative Note fixtures. It checks shared category membership and rename, category-name uniqueness per owner, category deletion uncategorizing both notes and chats without losing messages, initially empty Chat tables, orphan rejection, RLS, token hash uniqueness, token lifecycle column absence, and owner deletion isolation. It stops the container and removes its temporary storage when complete. These are direct SQL checks; they do not exercise Prisma's deployment history or live OAuth.

`pnpm test` runs both the Node unit tests and Nuxt component/composable tests. See the [test guide](../tests/README.md) for directory responsibilities, project-specific commands and coverage limits. Unit tests check authentication and Note API ownership using mocked sessions and database calls. Real GitHub sign-in and authenticated Note saving must be smoke-tested separately after running the app. Chat API ownership and safe Markdown are covered by unit tests; generation lifecycle and retry are covered by Nuxt composable tests. `pnpm test:chat` checks the built server against a disposable database and mock AI, including Note update/category/delete ownership checks; real OAuth remains a separate manual check.

## Running and verifying the app

```bash
pnpm dev
```

1. Open http://localhost:3001 and verify the landing page.
2. Use the start button to sign in with GitHub.
3. Verify that `/notes` opens and the avatar and user name are displayed.
4. Create a test note, save it, edit its title/body/category, and check Edit / Split view / Preview. Confirm that Cancel/Back with unsaved edits offers Keep editing / Discard changes. Use only a disposable test note for the confirmed-deletion check.
5. Verify desktop/medium/mobile layouts, bounded Markdown scrolling and draft preservation while resizing. New/saved notes use the same editor; Title and Category share a row from 768px and stack below it.
6. Create a test Chat and check send, generation cursor, partial save on disconnection and manual retry. Confirm that shared categories appear in both workspaces.
7. Verify that Sign out works from the avatar menu, including unsaved-note confirmation.
8. After signing out, verify that opening `/notes` directly redirects to `/login`.

`/api/health` reports only that the app is running; it does not confirm a database connection. Verify authentication and the actual database connection separately using the steps above after configuring credentials.

## OpenAI connection

Set `NUXT_OPENAI_API_KEY` in the ignored `.env` or the deployment's secret store. The user authorized sharing the existing nuxt-chat key. `NUXT_OPENAI_MODEL` defaults to `gpt-6.1-sol`; change it server-side when needed. No new OAuth or Supabase API keys are required. These settings are private runtime configuration; never place the key in `runtimeConfig.public`, browser storage, logs, or commits. Restart the server after changing local settings.

The first send saves the chat/question and then requests an answer. Missing AI configuration yields a retryable message without discarding the question. Provider/model access or quota failures also preserve the question. Shared-key requests use the same provider project limits and budget; no automatic paid retries or title-generation requests are made. Interrupted/failed partial answers remain saved. Application-level retention in OpenAI is disabled with `store: false`; this does not promise zero provider retention. See [OpenAI authentication](https://developers.openai.com/api/reference/overview#authentication), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [data controls](https://developers.openai.com/api/docs/guides/your-data), and [AI SDK cancellation](https://ai-sdk.dev/docs/advanced/stopping-streams).

Generation uses a 120-second server timeout and 4,096 output-token cap. The initial target remains a long-running Node server; verify the eventual host's streaming, proxy buffering and request-duration settings before deployment. There is no stream resumption or durable background worker.

Vercel is now the intended deployment platform. The [deployment preparation guide](deployment.md) covers serverless pooling, function duration, environment separation and hosted-streaming checks. No hosting configuration has been applied yet.

After `pnpm build`, run `pnpm test:chat` with Docker available. It never loads `.env`, uses a random session secret, starts a dedicated temporary PostgreSQL container and local built server, intercepts OpenAI requests with a test provider, and removes the container on completion. It does not exercise live OAuth or spend API credits. `pnpm test:chat --preview` keeps a loopback-only authenticated fixture at `http://127.0.0.1:3012/chats/new` until Ctrl+C for UI checks. This test proxy is never included in the application build.
