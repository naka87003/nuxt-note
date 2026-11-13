# Deployment

Nuxt Note runs on Vercel at [https://nuxt-note.com](https://nuxt-note.com).
This guide describes the production configuration and checks to run when updating
it. Dashboard settings and authenticated production behavior must be verified
on the target deployment; this document is not a record of completed checks.

## Vercel settings

Use Vercel's Nuxt integration with Node functions for server APIs, sessions,
PostgreSQL access, and AI streaming. Keep the framework-managed output settings.

| Setting           | Value / check                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repository / root | `naka87003/nuxt-note`, repository root                                                                                    |
| Production branch | `main`                                                                                                                    |
| Node              | Match the `engines` requirement in `package.json` and `.nvmrc`; verify build/runtime logs                                 |
| Package manager   | Use the version pinned in `package.json`; verify install logs                                                             |
| Install           | Frozen lockfile installation; retain postinstall for Nuxt preparation and Prisma generation                               |
| Build             | `pnpm build` (Prisma generation + Nuxt build; no migrations)                                                              |
| Nitro preset      | Vercel auto-detection, or `NITRO_PRESET=vercel` if explicitly needed                                                      |
| Function region   | Near the Supabase database; verify the deployed region                                                                    |
| Function duration | Allow the 120-second Chat generation timeout plus database work and final persistence; verify the effective hosting limit |
| Cache             | No shared/CDN caching or prerendering of authenticated pages, APIs, or OAuth/session routes                               |

Enter the build command as plain `pnpm build`, without Markdown backticks.
Check streaming, disconnection, partial persistence, retry, and stale-generation
recovery on Vercel itself. Local checks do not establish hosted behavior.

## Database and environment variables

Use the Nuxt Note Supabase database. Keep the original nuxt-chat database separate,
and isolate Preview/local data and secrets from production.

Runtime uses `@prisma/adapter-pg` with a maximum pool size of five per process;
multiple function instances can each create a pool. Use the Supabase Transaction
pooler connection for serverless runtime and a direct or Session pooler connection
for migrations. Verify TLS, connection limits, role privileges, and backup/restore
availability for the target database.

| Variable                          | Configuration                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | Server-only runtime connection for that environment                                                         |
| `DIRECT_URL`                      | Controlled migration/admin connection; deployed handlers do not need it                                     |
| `NUXT_APP_SECRET`                 | Stable random secret of at least 32 characters; separate in Preview                                         |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | Production GitHub OAuth App ID                                                                              |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | Production GitHub OAuth App secret                                                                          |
| `NUXT_OAUTH_GITHUB_REDIRECT_URL`  | Normally inferred; if an explicit override is needed, use `https://nuxt-note.com/auth/github` in Production |
| `NUXT_OPENAI_API_KEY`             | Server-only API key                                                                                         |
| `NUXT_OPENAI_MODEL`               | Optional override of the default model in `nuxt.config.ts`; verify model access                             |
| `NUXT_PUBLIC_SITE_URL`            | Leave unset for the current production domain; see below                                                    |
| `NUXT_MCP_ALLOWED_ORIGINS`        | Leave unset for Codex and same-origin browser clients; see below                                            |

Scope Production secrets to Production. Never upload `.env` or expose secrets in
public runtime config. Redeploy after adding, changing, or deleting Vercel
environment variables.

Builds do not apply migrations. For an existing database, check
`pnpm exec prisma migrate status` and apply pending migrations with
`pnpm db:migrate` through a controlled release step. For a fresh empty database,
apply the committed migrations once. Do not reset production, replay an applied
init, or delete migration history. Use new migrations for schema changes. See
[database initialization](development.md#database-initialization).

## Domain and MCP configuration

The canonical production origin is `https://nuxt-note.com`. Keep it in
`runtimeConfig.public.siteUrl` in `nuxt.config.ts`. It controls:

- Absolute social sharing image URLs.
- Note links returned by Chat and MCP, and same-site Note URL recognition in Chat.
- The canonical host and origin accepted by the MCP endpoint.

Leave `NUXT_PUBLIC_SITE_URL` unset in Vercel so the code default is used. Override
it only for an environment with a different origin, such as
`http://localhost:3001` for local Note links. Use an absolute HTTP(S) origin without
`/mcp` or another path.

MCP clients use the full endpoint URL, `https://nuxt-note.com/mcp`, with their
Bearer token. This client setting is separate from the site's origin setting.

Leave `NUXT_MCP_ALLOWED_ORIGINS` unset for native clients such as Codex and for
same-origin browser clients. The endpoint also accepts the Vercel deployment host
from `VERCEL_URL` and loopback development hosts. Set the variable only when an
additional browser origin needs access, using exact comma-separated origins
without paths. It does not add allowed destination hosts or remove token
requirements. See [MCP setup](mcp-notes.md).

Configure alternate production hostnames to redirect to the canonical origin.
When changing domains, update the code default or environment override, GitHub
OAuth registration, and MCP client URLs together, then redeploy and verify them.

## GitHub OAuth

Configure the production GitHub OAuth App with:

- Homepage URL: `https://nuxt-note.com`
- Authorization callback URL: `https://nuxt-note.com/auth/github`

Use separate OAuth Apps for production and local/Preview environments. A stable
staging hostname simplifies callback configuration. Do not force Preview callbacks
to production. Verify HTTPS redirect detection, Secure cookies, and Preview
Deployment Protection on the real host. Supabase Auth provider settings are not
used by this application's GitHub OAuth flow.

## Deployment verification

1. Review the release diff and run the applicable checks from `package.json`:
   lint, formatting, typecheck, unit tests, Prisma validation, and build. Run
   disposable database/Chat checks when relevant; never point fixtures at production.
2. Check migrations, scoped environment variables, OAuth callbacks, database
   backups, and a schema-compatible rollback target before deploying.
3. Verify the deployed runtime, package manager, region, and function duration.
   Check `/` and `/api/health`; health is liveness only, not database or OAuth readiness.
4. Verify GitHub login/logout, protected redirects, Note/Category operations, Chat
   streaming/retry/disconnection, and owner isolation using designated test records.
5. Verify social image URLs and MCP access, including token authentication, Note
   links, and token deletion. A tokenless MCP POST should return 401 rather than a
   host/origin rejection; this alone does not prove authenticated MCP operation.
6. Check desktop/mobile layouts and physical-device keyboard, IME, safe areas,
   and drafts when relevant to the release.

GitHub sign-in currently registers any successfully authenticated GitHub user.
There is no signup allowlist, per-user AI quota, or global application AI budget.
Set access/spending controls appropriate to the intended audience; per-chat locks
and output limits do not cap total spending.

Monitor sign-in failures, server errors/timeouts, database connections, stuck
Chat generations, and AI usage without logging private content or secrets.
Roll back only to a schema-compatible build. Application rollback does not restore
database data; never reset the database as a rollback step.
