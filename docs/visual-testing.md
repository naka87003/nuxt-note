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

## Coverage and viewports

Stories cover the note editor, Markdown, workspace list, chat composer, landing
previews/demo, and the collapsed/expanded agent setup guide. The current states
are defined in [`stories/`](../stories/); counts are not maintained here.

[`.storybook/preview.ts`](../.storybook/preview.ts) sets the shared 390px and
1280px Chromatic viewports. Override `parameters.chromatic.viewports` in a story
file's default export for all of its stories, or on an individual story.
Landing stories use overrides to match their responsive layouts.

Use real components with synthetic fixtures. The preview fixes the green/gray
dark theme and disables motion and the caret. Use `play` to reach stable states
through real controls and wait for meaningful content, fonts, and images.
Keep landing fixture widths aligned with `app/pages/index.vue`.

These are component/composed-view checks. Authenticated application pages,
routing, streaming, portalled dialogs, and alternate theme colors are outside
this coverage. Do not use live account data, OAuth, or AI responses for snapshots.

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
The workflow uses `--exit-zero-on-changes`: visual differences, including new
stories awaiting baselines, do not fail the Actions run. Build failures and story
execution errors still fail it. A successful Actions run confirms execution, not
visual approval. Review and accept intended changes in Chromatic; changes are not
automatically accepted. No Actions rerun is needed just to record that approval.

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
Local execution still exits with code `1` for visual differences by default;
add `--exit-zero-on-changes` to match the Actions behavior.

## Configuration

- [`.storybook/main.ts`](../.storybook/main.ts) selects the Nuxt framework,
  story files, and public assets.
- [`.storybook/preview.ts`](../.storybook/preview.ts) supplies Nuxt UI providers,
  the shared theme, and default viewports.
- `stories/tsconfig.json` inherits `.storybook/tsconfig.json` for Nuxt aliases.
- Story files import `Meta`/`StoryObj` through `@nuxtjs/storybook` and interaction
  helpers through `storybook/test`. ESLint checks Storybook conventions.

Keep private runtime defaults empty in `nuxt.config.ts`; the Nuxt Storybook
framework includes configured defaults in the static preview. Supply credentials
through environment variables and recheck generated output if runtime
configuration or framework behavior changes.

## Adding coverage

Place `*.stories.ts` under `stories/`. Prefer the real component with fixed props
and inline render setup when Nuxt state is needed. Give each important state
its own story; use a `play` function for deterministic interaction before
capture. Wait for meaningful content and local fonts, rather than adding arbitrary
delays. Keep authentication and data-fetching setup inside story fixtures.

Run the new stories locally and build Storybook before reviewing cloud snapshots.
Keep baseline updates a human review step rather than automatically accepting
every new screenshot.

References: [Nuxt Storybook](https://storybook.nuxtjs.org/getting-started/setup/),
[Chromatic setup](https://www.chromatic.com/docs/quickstart/).
