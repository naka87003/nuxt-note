# Deployment Preparation

## Status and scope

Read-only audit on 2026-11-03 (JST), starting from `main` at `b08f071`. The user intends to deploy to Vercel; hosting setup and domain are undecided. No provisioning, deployment, DNS/OAuth changes, migrations or database resets were performed.

## Production follow-up

Later on 2026-11-03 (JST), the user completed the Vercel deployment and reported that production appeared to work normally. The public URL is [https://nuxt-note-ivory.vercel.app](https://nuxt-note-ivory.vercel.app). An independent unauthenticated HTTP check returned 200 for `/` and 200 with `{"status":"ok"}` for `/api/health`. This establishes public HTTP availability, not a complete authenticated acceptance test. No production records were created or edited by the agent.

The production OAuth homepage is `https://nuxt-note-ivory.vercel.app` and the intended callback is `https://nuxt-note-ivory.vercel.app/auth/github`. The user was guided to configure Production-scoped `NUXT_OAUTH_GITHUB_CLIENT_ID`, `NUXT_OAUTH_GITHUB_CLIENT_SECRET`, `NUXT_APP_SECRET`, `DATABASE_URL` and `NUXT_OPENAI_API_KEY`, then redeploy. Exact dashboard values and OAuth registration were not independently inspected. `DIRECT_URL` is unnecessary for normal runtime/build operations; keep it for controlled Prisma CLI access if needed.

Prisma Postgres integration was intentionally not required: Prisma ORM connects to the existing Nuxt Note Supabase database. Keep the original nuxt-chat database separate. Enter the Build Command as plain `pnpm build`, without Markdown backticks or decorative characters; backticks caused the initial deployment failure by making the shell interpret build output as a command.

The audit table below preserves the initial findings. The proposed settings and release sequence remain a reference, not a claim that every step was completed. Still verify the actual Vercel plan, Node/pnpm versions, function duration/region, runtime pooler/TLS configuration, Preview isolation, backups, and long-stream/stop/retry behavior. Physical-device checks and public-access/AI spending controls remain pending. A custom domain is undecided; the current production hostname is established.

## Initial audit findings

| Area       | Confirmed                                                                                                                           | Required next                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Repository | Local `main` and cached `origin/main` are `b08f071`; working tree was clean before this documentation change                        | GitHub CLI API returned HTTP 401; remote deployment history/integrations could not be verified                                       |
| Hosting    | Vercel is the intended host; no tracked hosting configuration or GitHub Actions workflow                                            | Confirm account/team, plan, project, Git integration and Preview protection                                                          |
| Domain     | No production origin documented; user reports it is undecided                                                                       | Choose a stable project `vercel.app` hostname initially or a custom domain; verify availability/ownership                            |
| DB         | Local environment uses Supabase's Tokyo-region Session pooler on port 5432 for both connection variables                            | Confirm project ownership, production designation, Preview isolation, backups and limits                                             |
| Schema     | User, Category, Note, Chat, Message, and `_prisma_migrations` exist; no Project table. All five application tables have RLS enabled | Columns/RLS/history were checked, not every index, constraint, policy, grant or possible schema drift                                |
| Migration  | `20261103000000_init` finished at 2026-11-03 16:49:02 JST, with no rollback; recorded SHA-256 matches repository SQL                | No reset or init replay is needed due to an old init on this inspected target; inspect another target separately                     |
| OAuth      | Local Client ID, Client Secret and app secret are populated; handler is `/auth/github`                                              | Verify OAuth App owner, registered homepage/callback and production suitability in GitHub; real login remains untested in this audit |
| AI         | Local server-only API key populated; model defaults to `gpt-6.1-sol`                                                                | Configure deployment secrets, verify model access, budget and request controls                                                       |

DB inspection used `BEGIN TRANSACTION READ ONLY`, metadata SELECTs and ROLLBACK. No note/message contents were read and no Prisma migration commands were executed. Secrets and connection usernames were not printed or committed. Populated secrets do not prove credential validity.

Earlier development/integration notes describe the rewritten init as not yet applied at that time. This inspection supersedes that uncertainty for the currently configured target only. Do not infer another Supabase project's state from this result.

## Proposed Vercel settings

Use Vercel's Nuxt integration with Node functions for the server APIs, sessions, PostgreSQL driver and AI stream. A static export or Edge runtime does not fit the current application. Hosting compatibility still requires a successful hosted check. See [Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).

| Setting            | Proposed value / check                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository / root  | `naka87003/nuxt-note`, repository root                                                                                                             |
| Production branch  | `main`, after staging validation                                                                                                                   |
| Framework / output | Nuxt; retain framework-managed output settings                                                                                                     |
| Node               | 26.x, consistent with `>=26.11.1 <27`; verify actual build/runtime versions                                                                        |
| Package manager    | Enable `ENABLE_EXPERIMENTAL_COREPACK=1` and use committed `packageManager: pnpm@12.16.1`; verify install logs                                      |
| Install            | Frozen lockfile installation with pnpm 12.16.1; keep postinstall for Nuxt preparation and Prisma generation                                        |
| Build              | `pnpm build`: Prisma generation + Nuxt build; no migrations                                                                                        |
| Nitro preset       | Vercel auto-detection, or deployment variable `NITRO_PRESET=vercel`                                                                                |
| Function region    | Near the actual Supabase project, subject to plan support; confirm Tokyo in the dashboard                                                          |
| Duration           | Propose 180 seconds to allow the 120-second AI generation plus DB work and final persistence; verify plan/Fluid Compute support and deployed value |
| Cache              | No shared/CDN caching or prerendering of authenticated pages, APIs or OAuth/session routes                                                         |

Vercel manages Node minor/patch updates. Its [Node version documentation](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and [package-manager documentation](https://vercel.com/docs/package-managers) describe supported versions and selection. [Corepack configuration](https://vercel.com/docs/builds/configure-a-build#corepack) pins the package manager; lockfile detection alone should not be assumed to select pnpm 12.16.1.

The installed Nitro 2.13.5 preset accepts `nitro.vercel.functions.maxDuration` and emits `supportsResponseStreaming: true`. Proposed implementation, not yet applied:

```ts
// Merge into nuxt.config.ts after confirming the project/plan.
nitro: {
  vercel: {
    functions: { maxDuration: 180 },
  },
},
```

Verify generated `.vercel/output/functions/**/.vc-config.json` and hosted settings. Streaming counts toward duration; see [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration). Verify long responses, stop, partial persistence, and stale-attempt recovery on Vercel itself. Local Node validation cannot establish hosted stream/cancellation behavior.

## Database and environment variables

Decide whether to designate the inspected Nuxt Note DB as production or use a separate production DB. Keep Preview/local development separate from production data and secrets. The original nuxt-chat DB remains outside this release.

Runtime uses `@prisma/adapter-pg` with a pool maximum of five per process. Vercel can create multiple instances: five is not a deployment-wide cap. For serverless runtime, prepare the Supabase Transaction pooler URI from Connect (normally port 6543) and validate adapter/transaction behavior under concurrency. Keep migration access on a direct endpoint or an appropriate Session pooler endpoint, never Transaction mode. No local connection was changed. See [Supabase connection choices](https://supabase.com/docs/guides/database/connecting-to-postgres) and [Prisma setup](https://supabase.com/docs/guides/database/prisma).

Current connection URIs have no explicit `sslmode`; actual TLS was not inspected. Verify encryption and configure production certificate validation using Supabase's guidance. Do not disable certificate verification to fix connectivity. Confirm role privileges, RLS/Data API exposure, connection limits and backup/restore availability before release.

| Variable                          | Deployment action                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | Server-only runtime URI for that environment; Preview uses its own DB                                                        |
| `DIRECT_URL`                      | Controlled migration/admin environment; deployed handlers do not need it. Do not give migration access to untrusted previews |
| `NUXT_APP_SECRET`                 | Independent random production secret of at least 32 characters, stable across instances/releases; different in Preview       |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | Production OAuth App ID, separate from local/Preview configuration                                                           |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | Production OAuth App secret, server-only                                                                                     |
| `NUXT_OAUTH_GITHUB_REDIRECT_URL`  | Normally inferred; if needed, exactly `https://<canonical-host>/auth/github` for that environment                            |
| `NUXT_OPENAI_API_KEY`             | Server-only; authorized shared key is possible, with shared quota/cost implications                                          |
| `NUXT_OPENAI_MODEL`               | Record `gpt-6.1-sol` or another verified accessible model explicitly                                                         |

Use Vercel environment settings; never upload `.env` or expose secrets in public runtime config. Production runtime does not read the workstation's `.env`. Scope Production secrets to Production and redeploy after changing them. Installation/build must continue to avoid automatic migrations.

For a separately approved fresh empty DB, apply the init once through a controlled release step. For the inspected matching target, do not reset, drop schemas, replay init, or rewrite history using `migrate resolve`. If drift is discovered, design a new forward migration that preserves data, validate it on an isolated copy, and review backup/restore before applying it. Use new migrations for all future schema changes.

## Domain and OAuth

Choose one canonical HTTPS origin before production OAuth setup. A stable project `vercel.app` hostname can be used initially, with a custom domain later. Verify availability; do not assume a hostname is reserved. For a custom domain, add it to the project, use the exact DNS records Vercel presents, verify TLS issuance, and redirect alternate hostnames to the canonical origin. See [domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Inspect the existing Nuxt Note OAuth App first. Prefer separate production and local/Preview Apps so credentials and callbacks remain independent. Do not change nuxt-chat's App. Set production homepage to `https://<canonical-host>` and callback to `https://<canonical-host>/auth/github`. Supabase Auth provider configuration and API keys are unnecessary. See [GitHub OAuth App registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

Preview URLs vary. Use a stable staging hostname with its own OAuth App/DB for authenticated checks. Verify that Deployment Protection allows the intended browser callback; do not expose Preview broadly or place bypass secrets in callback URLs. Do not force Preview callbacks to production. Check Secure cookies and HTTPS redirect detection on the real host.

## Release sequence

1. Confirm Vercel team/project/plan, canonical hostname, production DB designation and OAuth ownership. Restore GitHub CLI authentication if remote history checks are needed; never put credentials in chat.
2. Prepare staging DB, OAuth App, app secret and scoped AI credentials. Configure Preview protection. Repository import/Git auto-deploy setup can trigger a deployment; review the target before enabling them.
3. Implement/review Vercel duration and package-manager settings. On Node 26.11.1, run lint, formatting, typecheck, unit tests, Prisma validation and build. With Docker, run disposable `test:db` and built-server `test:chat`; never target Supabase with fixtures.
4. Deploy staging with the Vercel preset. Check output, runtime/install versions, streaming, duration, region and environment separation. `/api/health` is liveness only, not DB/OAuth readiness.
5. On staging, verify GitHub login/logout, avatar and protected redirects; anonymous/other-user API rejection; Note save/edit/delete and unsaved guards; shared categories; Chat send/stop/partial persistence/retry, duplicate sends and two-tab concurrency. Use designated test accounts/records.
6. Check 1440/1024/768/390px layouts, GitHub Dark Markdown, code scrolling and LP assets. Check physical iOS/Android keyboard, IME, safe areas and drafts. Measure mobile first load with the approximately 293 kB gzip Markdown chunk.
7. Before unrestricted signup, decide access and AI spending controls. The OAuth handler upserts any successfully authenticated GitHub user. No signup allowlist, per-user rate/quota or global application AI budget is implemented. Per-chat locks/output caps do not limit parallel chats or total spending. Add controls or keep initial access restricted. Agree on privacy/data handling, support/deletion contact and operational ownership.
8. Review the exact release commit, backup/restore route, production variables, callback, limits and compatible rollback target. Production deployment, domain changes and write/cost-incurring production smoke tests are separate execution work.
9. Monitor sign-in failures, 5xx/timeouts, DB connections, stuck generations and AI usage without logging content/secrets. Roll back only to a schema-compatible build; application rollback does not restore DB data. Never reset the DB to roll back.

Remaining decisions/checks: Vercel plan and effective settings, custom domain, production DB designation and Preview isolation, OAuth App separation, initial audience and AI controls. The user completed deployment at the URL above; the agent's checks were read-only and the full release checklist remains unverified.
