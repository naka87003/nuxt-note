# Visual regression testing

Storybook renders actual Nuxt components with Nuxt UI, the application's CSS,
local Inter fonts and local icons. Chromatic captures the stories in cloud
browsers and compares them with approved baselines. Existing Vitest tests remain
responsible for application behavior.

## Local development

```bash
pnpm install
pnpm storybook
```

Open <http://localhost:6006>. No Chromatic account, database, GitHub OAuth or
OpenAI credentials are needed to develop stories. Storybook starts separately
from `pnpm dev` using the CLI, without registering a Nuxt module. Both use the
default `.nuxt/` generation directory; run preparation, builds and tests
sequentially. The application uses a fixed dark theme; automatic color-mode
switching is disabled for both the application and Storybook.

```bash
pnpm build-storybook
pnpm typecheck:storybook
```

The build creates `storybook-static/` for local inspection. The
separate typecheck covers Storybook configuration, stories and inline render setup.
Build success checks bundling; it does not mean that Chromatic has run or approved
screenshots.

## Initial coverage

The suite has 26 stories (55 snapshots per browser per full build). The original
19 stories use 390px and 1280px widths. Landing previews use 390px, 1024px and
1280px; the interactive landing demo uses only 1024px and 1280px, matching the
widths where the landing page mounts it.

| Area             | Stories                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Note editor form | Editing/split view, new empty note, unchanged, saving, save failure, over limit, preview selected             |
| Markdown         | Rich content with headings/lists/table/highlighted code, long content with Japanese text/wide table/long code |
| Workspace list   | Grouped notes with selected/untitled/long-title items, empty, loading, failure, no search results             |
| Chat composer    | Empty, message entered, multiline, sending, disabled                                                          |
| Landing previews | Notes workspace, Chat workspace, responsive Chat-to-note preview                                              |
| Landing demo     | Generation confirmation, editing, discard confirmation, saved note                                            |

Editor models stay interactive in local Storybook. The Preview story clicks the
actual tab and checks that the preview is visible before Chromatic captures it.
Fixtures use synthetic content and a fixed reference time for list grouping.
The preview fixes the default green/gray dark theme and disables CSS motion and
the caret. Application components and their styles are not stubbed.

Landing stories reproduce the page’s content width, mobile padding and desktop
Chat column width. Keep `stories/fixtures/landing.css` (shared content width and
padding) and the Chat story’s responsive width classes in
`stories/LandingWorkspacePreview.stories.ts` aligned with `app/pages/index.vue`. The responsive preview waits for the lazy desktop demo or
asserts the mobile static fallback. Demo stories reach each stable state through
real controls, waiting for generation/saving to finish rather than using fixed
screenshot delays. They also wait for local fonts and preview images. Transient
generating/saving states are not captured.

These are component/composed-view checks, not complete application pages.
Authenticated layouts, routing, ChatSession/streaming, portalled dialogs and
alternate theme colors are not yet covered. Add them as separate stories with
explicit fixtures; add MSW when a story needs network responses. Avoid using
live OAuth, AI responses or production data to prepare a snapshot.

## GitHub Actions manual execution

1. Create a [Chromatic account](https://www.chromatic.com/) and a **Storybook**
   project, linked to this GitHub repository.
2. Get its Project Token. Do not commit it or paste it into a chat.
3. Add a repository Actions secret named `CHROMATIC_PROJECT_TOKEN` in GitHub:
   **Settings → Secrets and variables → Actions → New repository secret**.
   The application's `.env` does not need this token.
4. Commit and push the workflow and changes to the default branch (`main`).
5. Open **Actions → Storybook VRT → Run workflow**, select `main`, and run it.
6. Follow the Chromatic build link in the logs to review the snapshots. The first
   build establishes the baseline. Accept intended changes on later builds;
   fix unexpected changes, commit, push and run the workflow again.

The workflow has only `workflow_dispatch`: neither pushes nor PRs trigger VRT.
No dedicated test branch is needed. Actions checks the pushed commit on the
selected branch; local uncommitted or unpushed changes are not included.

Each run installs locked dependencies and typechecks stories, then invokes the
Chromatic CLI. The CLI builds Storybook with the default `build-storybook` script,
uploads it and runs cloud visual tests. A missing or invalid project token causes
failure. Application/database/OAuth/OpenAI secrets are not needed in Actions.
Changes are not automatically accepted and `--exit-zero-on-changes` is not enabled.
An intentional visual change can therefore make the Actions run fail until it is
reviewed in Chromatic; accepting a change does not rewrite a completed Actions run.

Chromatic can skip a rebuild for the same commit if the last build on that branch
already passed or was accepted. This is expected when rerunning an unchanged commit.

Screenshots, baselines and reviews live in Chromatic, not this repository.
Internet access and an available snapshot allowance are required for cloud VRT.
The story count, viewports, browsers and build frequency affect usage.

### Optional local execution

`pnpm storybook` and `pnpm build-storybook` remain available for local development.
If needed, `pnpm chromatic` can also be run with `CHROMATIC_PROJECT_TOKEN` set in
your shell. The CLI script does not load `.env` automatically. For uncommitted
changes on an already accepted commit, use `pnpm chromatic --force-rebuild`.
This still uploads to Chromatic and consumes its snapshot allowance.

## Configuration and dependencies

- `@nuxtjs/storybook` provides the Nuxt integration and depends on
  `@storybook-vue/nuxt` (the Storybook framework).
- `storybook` provides the CLI. Storybook packages use the same release line.
- Stories import `Meta`/`StoryObj` through `@nuxtjs/storybook`; a direct renderer
  dependency is not needed.
- `eslint-plugin-storybook` adds its flat recommended rules to `pnpm lint`,
  covering story exports, awaited interactions and Storybook imports.
- `chromatic` provides the upload/test CLI.
- `.storybook/main.ts` chooses the Nuxt framework, stories and `public/` assets.
- `.storybook/preview.ts` defines the shared `UApp` decorator inline for Nuxt UI
  providers. Workspace state is initialized directly in its story's render setup.
- `stories/tsconfig.json` inherits the Storybook typecheck configuration so the
  editor can discover Nuxt aliases such as `#imports` for story fixtures.
- `nuxt.config.ts` uses `ui.colorMode: false` to disable automatic theme switching
  for the application and Storybook. Both fix the HTML dark class.
  Authentication retains its default session-fetching behavior; the static
  Storybook has no authentication API.
- The installed Nuxt framework serializes configured runtime defaults into the
  static preview, including private fields. Keep secret defaults empty and supply
  credentials through environment variables, rather than hardcoding them in
  `nuxt.config.ts`. A local build with `.env` loaded and a dummy server API key
  did not contain those environment values. Recheck generated output if runtime
  configuration or the framework's behavior changes.

An additional Playwright test runner, Vitest Browser Mode, the Chromatic panel
addon and MSW are not required for this initial suite.

## Adding coverage

Place `*.stories.ts` under `stories/`. Prefer the real component with fixed props
and inline render setup when Nuxt state is needed. Give each important state
its own story; use `play` from Storybook for deterministic interaction before
capture. Wait for meaningful content and local fonts, rather than adding arbitrary
delays. Keep authentication and data-fetching setup inside story fixtures.

Run the new stories locally and build Storybook before reviewing cloud snapshots.
Keep baseline updates a human review step rather than automatically accepting
every new screenshot.

References: [Nuxt Storybook](https://storybook.nuxtjs.org/getting-started/setup/),
[Chromatic setup](https://www.chromatic.com/docs/quickstart/).
