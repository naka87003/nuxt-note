# Nuxt Note

A single Nuxt application centered on Markdown notes, with integrated private AI chat adapted from nuxt-chat. The service, repository, and package name are nuxt-note; the display name is Nuxt Note. The interface uses English and a dark theme.

Development continues in this repository. The original nuxt-chat repository remains a reference, and nuxt-apps remains an archive. Existing Chat users, projects, conversations, and messages will not be imported. See the [integration plan](docs/integration.md) for the shared user, authentication, and database decisions and the first implementation scope.

## Current implementation

- Nuxt 4 / Nuxt UI v4 / TypeScript project foundation
- Figma-aligned responsive landing page with adopted artwork, Notes/Chat previews, feature cards and authentication-aware calls to action
- Sign-in page and authenticated workspace entry
- GitHub OAuth, user registration, profile display, and sign-out foundation
- Updated-date grouping with boundary tests
- Authenticated note creation/editing, explicit title/body/category saving, confirmed deletion, grouped listing and safe Markdown reading
- Shared new/saved-note editor with desktop split and mobile Edit/Preview, unsaved-change confirmation, and retryable save errors
- Shared session authentication helper with database UUID validation
- Shared User, Category, Note, Chat, and Message models in one unified initial migration; notes and conversations reference the same Category
- Shared category CRUD with normalized names, workspace-specific counts, owner checks, and content-preserving deletion
- Figma-aligned Notes / Chat shell: desktop three columns, medium two columns, mobile list/reader navigation, accessible category drawer, and pinned Nuxt UI workspace Tabs
- Category and workspace switching with filter/search/scroll state preservation and unsaved-note guards
- Owner-scoped Note and Chat search with literal wildcard handling; Chat history, saved conversation reading, category reassignment, and confirmed deletion
- Chat creation, OpenAI streaming, generation cursor, partial-answer persistence on disconnection, manual retry, and safe assistant Markdown
- Chat-to-Note creation with confirmation, non-cancellable AI organization, a Markdown draft of up to 3,000 characters, inherited category, and explicit review/save or discard; no source-chat relation or schema change
- Ask AI from a saved Note opens a new chat in the Note's category with its link prefilled; add a question and send when ready. AI reads the saved Note through the existing Note tools.
- New chats have no saved title and display “Untitled chat” until a summary is ready. After the first answer completes, a separate request summarizes that exchange in the question's language and reveals the title in the heading and list with a typewriter animation, without blocking the next message. It uses the configured OpenAI model; failures keep the existing title, and later exchanges do not regenerate it. Reduced-motion preferences disable the animation.
- Request UUIDs, a database generation guard, and stale-attempt recovery to prevent duplicate or late writes
- Disposable PostgreSQL checks for initial schema creation, RLS, foreign keys, and deletion behavior

Notes readers, live previews and Chat assistant messages share GitHub Dark code syntax highlighting. New Chat creates records only on the first send, immediately shows the question and cursor, and preserves the conversation view and stream while updating the URL. The Notes and Chat workspaces shown on the landing page are static design previews, rendered with Vue and CSS without account data or API calls. Actual sign-in requires an OAuth App and database configuration.

Code blocks in Notes readers/previews and Chat assistant messages include a copy icon in the upper-right corner without a header or divider. The icon appears on hover, keyboard focus, or a tap on the code block. Copying uses the parsed code and reports success with a checkmark or a retryable failure with a cross. Inline code and static landing-page previews have no copy controls.

Markdown rendering uses `@comark/nuxt` with a shared parser and a Vue code-block component. Copy controls use Nuxt UI buttons and icons. Comark’s Shiki plugin supplies highlighted Vue nodes; no application component uses `v-html`. The plain-Markdown configuration disables authored HTML, component/attribute extensions and automatic links. Comark’s security plugin restricts link protocols and blocks images, with standard Markdown line breaks, tables and code parsing. List previews use Comark parsing too. Saved Markdown and database schemas are unchanged.

The shared workspace foundation follows the agreed Figma structure. Note readers, live previews and Chat assistant messages share the Comark renderer with raw HTML and authored components disabled, with safe URL protocols, no remote images and escaped syntax tokens. The redesigned landing page follows the approved 1440px, 1024px, 768px and 390px Figma compositions.

Workspace API coverage includes category name validation/conflicts, per-owner lists/counts/mutations, foreign-category rejection on note creation and Chat reassignment, and parent-owned message reads. Validation uses mocked sessions/database calls and a temporary fixture app for browser checks; no live database or OAuth account is modified. Browser checks covered 1440px, 1024px, 768px and 390px layouts, workspace filter/count changes, list collapse/restore, drawer dismissal, shared category creation, and unsaved-edit cancellation/confirmation. The database must already use the shared-category init described in the integration plan.

Chat runtime validation includes unit tests and disposable HTTP checks for streaming, disconnect/partial save, failure/retry, duplicate sends, concurrent generation and owner isolation. The shared OpenAI key/default model was checked with one short successful request. The unified init defines the current schema. See the development guide for database initialization and subsequent migrations.

## Getting started

Production: [nuxt-note-ivory.vercel.app](https://nuxt-note-ivory.vercel.app). The user completed the Vercel deployment and reported normal operation on 2026-11-03; public home/health HTTP checks also passed. See the [deployment guide](docs/deployment.md) for configuration, verification scope and remaining release checks.

Use Node.js 26.11.1 and pnpm 12.16.1.

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env
```

Configure `.env` before starting the app. The landing page can be viewed without a database connection.

```bash
pnpm dev
```

Development URL: [http://localhost:3001](http://localhost:3001). This uses a separate port from nuxt-chat.

See the [development guide](docs/development.md) for authentication and database setup, and the [specification](docs/specification.md) for features and interaction rules.

## Social sharing image

All pages use `public/images/og-image.png` (1200 × 630) for Open Graph and
large-image Twitter/X cards. The shared artwork uses the application logo and
landing-page copy, with visual references from [Nuxt](https://nuxt.com/) and
[Nuxt UI](https://ui.nuxt.com/). No private note or chat content is included.

`NUXT_PUBLIC_SITE_URL` sets the public origin for the absolute image URL and
defaults to `https://nuxt-note-ivory.vercel.app`. No additional environment
configuration is required for that domain. Set it when changing the production
domain. The PNG is committed, so builds need no image-generation
dependency. The editable source is the [OG Image frame in Figma](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=420-4057),
in the Social Sharing section. To change the artwork, edit that frame,
export PNG at 1× (1200 × 630), and replace `public/images/og-image.png`.
Shared social titles and descriptions live in `app/utils/seo.ts` and are also
used by the landing page.

## MCP

The remote Streamable HTTP endpoint at `/mcp` supports searching, reading,
creating, updating, and permanently deleting the token owner's Notes.
Open **Profile menu → Agent access** for token management and connection
instructions, including a Codex setup example. No project clone or local MCP
process is required. See the [Notes MCP guide](docs/mcp-notes.md) for protocol,
authentication, and deployment details.

## Validation

Visual regression tests use Storybook + Chromatic. Run `pnpm storybook` to view
the component stories, or
`pnpm build-storybook` to verify the static build. After pushing changes, run VRT
manually from **Actions → Storybook VRT → Run workflow** using the
`CHROMATIC_PROJECT_TOKEN` repository Actions secret. Pushes do not automatically
run VRT. See the
[visual testing guide](docs/visual-testing.md) for coverage and setup.

Chat-to-Note validation: 259 unit tests, lint, formatting, typecheck and production build pass. Disposable HTTP checks cover owner isolation, Markdown draft generation, inherited category and no implicit Note save or conversation edits. Browser checks at desktop and 390px cover confirmation, non-dismissible generation, draft handoff, preview, unchanged-draft discard confirmation, return to Chat, keeping edits and explicit Save. AI responses were mocked; no live provider requests or production data were used. Self-review added regression checks for failed/redirected navigation cleanup, one-use draft delivery, late-navigation isolation, a shared shortening timeout, and manual Note bodies exceeding the AI-only limit. Draft handoff state is centralized; AI requests use JSON output mode with explicit shortening instructions.

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
# Optional: requires a running Docker engine; uses a disposable database only.
pnpm test:db
pnpm db:validate
pnpm build
# Requires the build and Docker; isolated DB + mock AI, no live API calls.
pnpm test:chat
```

Notes editor validation: 122 passing unit tests, lint, typecheck, formatting and production build; disposable HTTP tests cover Notes mutations and Chat regression. Browser fixture checks cover new-note save/preview, saved-note editing, unsaved Cancel/Back, draft preservation, category reassignment, desktop split, 1024px/768px/390px layouts, and save-failure draft retention. No production data or database schema is changed. Figma's [Notes editing board](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=135-1583) and the specification document the final interaction contract.

Landing page validation: lint, typecheck, formatting, 122 unit tests and production build pass. Browser checks cover 1440px/1024px/768px/390px compositions, three-column/two-column/mobile previews, local artwork, horizontal overflow, section anchors and signed-in/signed-out CTA destinations. The previews are illustrative and do not edit notes or send AI requests.

Syntax highlighting uses Comark's core Shiki plugin with explicit local languages and the GitHub Dark theme. The plugin handles highlighter initialization and token nodes; application code has no HTML-string highlighter, manual highlight cache or `v-html`. Tests cover supported languages/aliases, theme colors, malicious source and fence metadata, whitespace, long code, incomplete streaming fences and copy feedback. Language-name handling and plain-text fallback follow the plugin defaults; previous custom length cutoffs and case normalization are removed. There is no highlighting API or runtime language download. Physical-device checks remain pending.

## Design and documentation

- [Specification](docs/specification.md)
- [Shared foundation and Chat integration plan](docs/integration.md)
- [Development and environment setup](docs/development.md)
- [Notebook data migration](docs/notebook-migration.md)
- [Deployment preparation and read-only environment audit](docs/deployment.md)
- [Figma and implementation workflow](docs/design.md)
- [Current desktop workspace designs](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=39-776)
- [Current mobile workspace designs](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=40-647)
- [Notes editing / Desktop and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=135-1583)
- [Responsive variants / Medium and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=106-1023)
- [Desktop landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=60-924)
- [Mobile landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=61-1093)

## Project language

Use English for project documentation, the README, code comments, and UI text. This convention does not restrict the language of notes written by users.

## Directory structure

```text
app/          Vue pages, layouts, and middleware
server/       Server APIs, OAuth, and database access
shared/       Types and shared logic
prisma/       Database schema and migrations
tests/        Unit, Nuxt component, and database tests (see tests/README.md)
docs/         Specification, setup, and design workflow
scripts/      Disposable database verification
```
