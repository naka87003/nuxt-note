# Development and Environment Setup

## Requirements

- Node.js 24.16.0 / pnpm 12.16.1
- PostgreSQL, either a new Supabase project or a local database
- A GitHub OAuth App

Use a separate OAuth App and database from nuxt-chat. Do not share its existing data.

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

Before running these commands, verify that `.env` points to the new database dedicated to Nuxt Note.

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

`db:migrate` applies the SQL committed to this repository. It does not create a shadow database on Supabase. RLS is enabled on User, Category, and Note to prevent anonymous access through the Data API. The database role used by the Prisma server connection must have the required database permissions.

## Running and verifying the app

```bash
pnpm dev
```

1. Open http://localhost:3001 and verify the landing page.
2. Use the start button to sign in with GitHub.
3. Verify that `/notes` opens and the avatar and user name are displayed.
4. Verify that Sign out works from the avatar menu.
5. After signing out, verify that opening `/notes` directly redirects to `/login`.

`/api/health` reports only that the app is running; it does not confirm a database connection. Verify authentication and the actual database connection separately using the steps above after configuring credentials.
