# Development and Environment Setup

## Requirements

- Node.js matching `.nvmrc` and pnpm matching `package.json`
- PostgreSQL, using the existing Nuxt Note database or a local development database
- A GitHub OAuth App

Notes and Chat share one GitHub login, session, and PostgreSQL database. Keep development and production environments separate. The original nuxt-chat database and OAuth configuration remain untouched; existing Chat data is not imported. See the [specification](specification.md#data-boundaries) for identity and ownership rules.

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
- Production runs on Vercel. See the [deployment guide](deployment.md) for serverless connection pooling and environment separation.

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

Session identity and ownership are defined in the [specification](specification.md#data-boundaries).
Server APIs use `getAuthenticatedUserId` from `server/utils/auth.ts`.

## Tests

Run `pnpm test` for unit and Nuxt tests. `pnpm test:db` requires Docker;
`pnpm test:chat` also requires a build. See the [test guide](../tests/README.md)
for disposable integration checks and coverage limits.

For browser checks with mock AI and a disposable database, run
`pnpm test:chat --preview` after building. It serves an authenticated fixture at
`http://127.0.0.1:3012/chats/new` until Ctrl+C; it does not test real GitHub OAuth.

## Running and verifying the app

```bash
pnpm dev
```

1. Open http://localhost:3001, sign in with GitHub, and check that `/notes` displays your profile.
2. Create, edit, and delete a disposable Note; check Markdown preview and unsaved-change confirmation.
3. Send a Chat message, verify shared categories, and check desktop/mobile layouts.
4. Sign out, then verify that opening `/notes` redirects to `/login`.

`/api/health` checks liveness only. Use the [deployment checklist](deployment.md#deployment-verification)
for full hosted verification, including streaming recovery and physical devices.

## OpenAI connection

Set `NUXT_OPENAI_API_KEY` in the ignored `.env` or the deployment's secret store. `NUXT_OPENAI_MODEL` defaults to `gpt-6.1-sol`; change it server-side when needed. No new OAuth or Supabase API keys are required. These settings are private runtime configuration; never place the key in `runtimeConfig.public`, browser storage, logs, or commits. Restart the server after changing local settings.

Answer and title generation use the same configured model and incur API usage.
Provider project limits and budgets apply to all requests sharing that project.
Requests use `store: false`, which does not promise zero provider retention.
See the [Chat specification](specification.md#chat-creation-and-ai-generation) for
generation limits and failure/retry behavior, and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
for provider retention settings.

Use the [deployment guide](deployment.md) for Vercel environment configuration,
connection pooling, function duration, and hosted-streaming checks.
