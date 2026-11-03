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
- Chat creation, OpenAI streaming, stop with partial-answer persistence, manual retry, and safe assistant Markdown
- Request UUIDs, a database generation guard, and stale-attempt recovery to prevent duplicate or late writes
- Disposable PostgreSQL checks for initial schema creation, RLS, foreign keys, and deletion behavior

Notes readers, live previews and Chat assistant messages share GitHub Dark code syntax highlighting. New Chat creates records only on the first send. The Notes and Chat workspaces shown on the landing page are static design previews, rendered with Vue and CSS without account data or API calls. Actual sign-in requires an OAuth App and database configuration.

The shared workspace foundation follows the agreed Figma structure. Note readers, live previews and Chat assistant messages share the HTML-disabled MarkdownIt renderer, with safe URL protocols, no remote images and escaped syntax tokens. The redesigned landing page follows the approved 1440px, 1024px, 768px and 390px Figma compositions.

Workspace API coverage includes category name validation/conflicts, per-owner lists/counts/mutations, foreign-category rejection on note creation and Chat reassignment, and parent-owned message reads. Validation uses mocked sessions/database calls and a temporary fixture app for browser checks; no live database or OAuth account is modified. Browser checks covered 1440px, 1024px, 768px and 390px layouts, workspace filter/count changes, list collapse/restore, drawer dismissal, shared category creation, and unsaved-edit cancellation/confirmation. The database must already use the shared-category init described in the integration plan.

Chat runtime validation includes unit tests and disposable HTTP checks for streaming, stop/partial save, failure/retry, duplicate sends, concurrent generation and owner isolation. The shared OpenAI key/default model was checked with one short successful request. Schema changes are consolidated into the prerelease init at the user’s request; no existing database was reset or migrated. See the development guide before adopting the rewritten init.

## Getting started

Production: [nuxt-note-ivory.vercel.app](https://nuxt-note-ivory.vercel.app). The user completed the Vercel deployment and reported normal operation on 2026-11-03; public home/health HTTP checks also passed. See the [deployment guide](docs/deployment.md) for configuration, verification scope and remaining release checks.

Use Node.js 24.16.0 and pnpm 12.16.1.

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

## Validation

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

Syntax highlighting validation: 160 unit tests, lint, typecheck, formatting and production build pass. New tests cover the shared Notes/Chat output, Figma GitHub Dark colors, supported languages/aliases, malicious code and fence labels, whitespace, incomplete streaming fences, and plain-text fallback for unsupported/large code and highlighter failure. A temporary component fixture verified both Markdown components at 1440px and 390px, live updates, code-only horizontal scrolling, and no rendered scripts/images/unsafe links; no production content was used. The fixture was removed before the production build. Shiki's selected local grammars/theme add bundle weight (the shared Markdown client chunk is approximately 293 kB gzip); there is no highlighting API or runtime language download. Physical-device checks remain pending.

## Design and documentation

- [Specification](docs/specification.md)
- [Shared foundation and Chat integration plan](docs/integration.md)
- [Development and environment setup](docs/development.md)
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
tests/unit/   Tests for shared logic
docs/         Specification, setup, and design workflow
scripts/      Disposable database verification
```
