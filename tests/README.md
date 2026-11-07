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
└── helpers/               Mock OpenAI provider used by the built-server check
```

## Vitest

```bash
pnpm test                  # Both unit and Nuxt tests
pnpm test --project unit   # Node tests only
pnpm test --project nuxt   # Nuxt component and composable tests only
```

The `unit` project imports source modules directly and mocks Nuxt globals, database access and AI providers as needed. Test files use relative source imports. The existing `#shared` alias is retained because application modules import shared code through it; no additional `~` or `~~` aliases are configured for this project.

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

## Disposable integration checks

| Command                                 | Prerequisites           | Scope                                                                            |
| --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `pnpm test:db`                          | Docker                  | Applies the migration and runs `database/` SQL fixtures/assertions               |
| `pnpm test:chat`                        | Docker and `pnpm build` | Exercises the built HTTP server with temporary PostgreSQL and a mock AI provider |
| `node scripts/test-notebook-import.mjs` | Docker                  | Checks preview, ownership, rollback and repeat imports using synthetic CSV files |

These integration scripts are separate from `pnpm test`. They do not load application credentials or target the configured application database. Real GitHub OAuth remains a manual check. See [development](../docs/development.md) and [Notebook migration](../docs/notebook-migration.md) for details.
