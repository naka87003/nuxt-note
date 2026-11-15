# Tests

Tests are separated by execution environment. Each Vitest test file belongs to exactly one project.

```text
tests/
├── unit/                  Node tests with mocked external dependencies
│   ├── app/utils/         Markdown rendering and stream parsing
│   ├── server/
│   │   ├── api/           Route handlers, authentication and ownership
│   │   └── utils/         Authentication, validation and output buffering
│   ├── shared/utils/      Shared preview and date-grouping logic
│   └── scripts/           Notebook import parsing and validation
├── nuxt/
│   ├── components/        Mounted Vue components in the Nuxt environment
│   ├── composables/       Client state and request flows in the Nuxt environment
│   ├── helpers/           Composable lifecycle harness
│   ├── setup.ts           Wrapper cleanup and browser-global restoration
│   └── setup.test.ts      Cleanup-order regression test
├── database/              SQL fixtures and assertions for disposable PostgreSQL
├── integration/           Real PostgreSQL checks (dedicated command)
├── ai/                    Real AI provider checks (dedicated command)
└── helpers/               Mock OpenAI provider used by the built-server check
```

## Vitest

```bash
pnpm test                  # Both unit and Nuxt tests
pnpm test --project unit   # Node tests only
pnpm test --project nuxt   # Nuxt component and composable tests only
```

`pnpm test` includes only `unit/` and `nuxt/`. External-service tests live in
separate suites and are excluded rather than reported as skipped. Setting their
environment variables does not enable them in the normal suite.

The `unit` project imports source modules directly and mocks Nuxt globals, database access and AI providers as needed. The unit, integration and AI projects share Nuxt-compatible aliases from `tests/aliases.ts`: `~/` for `app/`, `~~/` for the repository root and `#shared/` for `shared/`. Use the same paths for source imports and `vi.mock` calls. The `nuxt` project uses Nuxt's built-in aliases.

The `nuxt` project uses `@nuxt/test-utils`, `mountSuspended` and Happy DOM, with the application's auto-imports and plugins. It loads `.env.test` rather than `.env`; application credentials are unnecessary. Note and chat requests are mocked, and authentication uses synthetic session state. These tests do not contact the application database or AI provider.

Composable tests use actual Vue mount/unmount hooks and Nuxt shared state. Nuxt request and navigation mocks use `mockNuxtImport`; external fetches remain mocked. `useWorkspace` and draft handoff tests use the Nuxt router and synthetic sessions, with failed handoff navigation results simulated. The mounted host components are unmounted after every test, before browser globals are restored. Both cleanup steps run in one teardown callback so they do not depend on Vitest's reverse ordering of `afterEach` hooks.

Component coverage focuses on:

- `ChatComposer`: draft binding, submission, IME/Shift+Enter and disabled states.
- `NoteEditor`: create/update requests, duplicate saves, failure recovery, draft preservation, unsaved-change confirmation and browser-close protection.
- `NoteEditorForm`: input models, save availability, view switching and media-query changes.
- `UnsavedChangesModal`: keep/discard/dismiss decisions connected to the actual confirmation plugin.
- `ChatSession`: composer/generation wiring, errors and retry, and note-generation confirmation/loading states.
- `WorkspaceList`: loading/error/empty/search states and workspace/category links.

Modal shells, tooltips and title animation are stubbed where their library behavior is outside the component's responsibility. Chat generation is mocked in `ChatSession` tests; its request lifecycle is covered separately under `nuxt/composables/`. Editor route guards are captured through `mockNuxtImport` and their decisions are tested directly; full router navigation is not exercised.

Happy DOM tests verify component behavior, not browser layout. Media-query changes are simulated. Scrolling geometry, actual resizing, focus behavior in portals and full navigation still need browser checks.

## Runner initialization and caching

Persistent transformed-module caching (`fsModuleCache`) is disabled in `vitest.config.ts`. With multiple pnpm peer-dependency installations of the same Vitest version, cached imports can reference a different Vitest runtime from the active runner. This was reproduced as both `Vitest failed to find the runner` and `Cannot read properties of undefined (reading 'config')` during test collection; bypassing the cache made the same tests pass.

Normal `pnpm test` runs rebuild transforms while retaining test-file isolation. This adds some transform time but avoids reusing these incompatible imports. See Vitest's [persistent module cache documentation](https://vitest.dev/config/fsmodulecache.html).

Old caches can be removed with:

```bash
pnpm exec vitest --clearCache
```

## Dedicated PostgreSQL and AI suites

```bash
pnpm test:integration      # 20 category move/merge checks with temporary Docker PostgreSQL
pnpm test:ai               # One real-model tool-use check (billable)
```

Neither command skips tests when prerequisites are missing: it exits with an
error. These suites use their own Vitest configs and do not start the Nuxt test
environment.

### PostgreSQL

Start Docker, then run:

```bash
pnpm test:integration
```

The command starts a disposable `postgres:17-alpine` container (downloading the
image on first use), binds PostgreSQL to an available loopback port, applies all
SQL migrations in order, and runs the integration suite. It removes the container
and its volumes on completion, failure, Ctrl+C (`SIGINT`), or `SIGTERM`. The test
runner is also terminated on interruption. Docker being unavailable is an error,
not a skipped test.

It never reads `.env`, `DATABASE_URL`, or `DIRECT_URL`. The script supplies its own
`NUXT_NOTE_MOVE_TEST_DATABASE_URL`, overriding any inherited value, so no manual
database creation, migration, or connection configuration is required. The suite
also checks the local hostname and test database name prefix before connecting.

### AI

`pnpm test:ai` loads `.env` for `NUXT_OPENAI_API_KEY` and the optional
`NUXT_OPENAI_MODEL`. Notes are mocked, but model requests are real and billable.
The test checks that the model uses tools to read and edit a linked Note even
after an earlier incorrect refusal. It is an optional model/prompt regression
check; it does not access a real database and is not part of `pnpm test`.

## Other integration checks

Agent access also has an explicit real-database check: build and apply its
migration first, then run `pnpm test:agent --live`. Unlike the disposable commands
below, this loads `.env`, uses an existing user, and creates narrowly identified
verification records which it removes in `finally`. See the
[saved Notes MCP guide](../docs/mcp-notes.md) before running it.

`pnpm check:mcp:remote` is a read-only check of the configured remote MCP credentials.
It searches and reads one Note without printing its contents.

| Command                                 | Prerequisites           | Scope                                                                            |
| --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `pnpm test:db`                          | Docker                  | Applies the migration and runs `database/` SQL fixtures/assertions               |
| `pnpm test:chat`                        | Docker and `pnpm build` | Exercises the built HTTP server with temporary PostgreSQL and a mock AI provider |
| `node scripts/test-notebook-import.mjs` | Docker                  | Checks preview, ownership, rollback and repeat imports using synthetic CSV files |

All four disposable DB scripts (`test:integration`, `test:db`, `test:chat`, and
Notebook import) use `scripts/lib/test-database.mjs` to apply every committed SQL
migration in directory order before adding their fixtures. The same helper
removes containers and volumes on completion, failure, `SIGINT`, and `SIGTERM`.
Child app/runner processes and Notebook temporary files are cleaned up as well.
Force-killing the process (`SIGKILL`) cannot run cleanup handlers.

The disposable integration scripts in the table are separate from `pnpm test`. They do not load application credentials or target the configured application database. Real GitHub OAuth remains a manual check. See [development](../docs/development.md) and [Notebook migration](../docs/notebook-migration.md) for details.

Browser Note updates and deletions use the same owner-scoped, version-checked
operations as Chat and MCP. Unit tests cover missing/invalid versions, atomic
concurrent writes, and 404/409 handling. Nuxt component tests cover preserving
local drafts, explicit overwrite confirmation without full-content comparison,
repeated conflicts, cancellation, and reopening deletion confirmation after
refreshing the latest content. The disposable `pnpm test:chat` HTTP smoke also
checks version validation, stale writes, concurrent saves, and confirmed-version
overwrite against PostgreSQL.
