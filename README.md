# Nuxt Note

A Nuxt 4 / Nuxt UI application for private Markdown notes and AI chat, with GitHub
sign-in, shared categories, search, and Markdown previews. Chat can use saved Notes
and generate editable Note drafts. Remote agents can access Notes through MCP.
The interface uses English and a dark theme.

Production: [nuxt-note.com](https://nuxt-note.com), hosted on Vercel.

## Getting started

Use the Node.js version in `.nvmrc` and the pnpm version pinned in `package.json`.

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env
```

Configure `.env` using the [development guide](docs/development.md), then start:

```bash
pnpm dev
```

Development URL: [http://localhost:3001](http://localhost:3001).
The landing page can be viewed without a database connection.

## Checks

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

See the [test guide](tests/README.md) for coverage, prerequisites, and optional
integration checks. Use the [visual testing guide](docs/visual-testing.md) for
Storybook and manual Chromatic runs. Record change-specific implementation and
verification results in pull requests; keep documentation focused on current
behavior and repeatable procedures.

## MCP

Open **Profile menu → Agent access** for token management and connection
instructions. The production endpoint is `https://nuxt-note.com/mcp`.
See the [MCP guide](docs/mcp-notes.md) for authentication and supported operations.

## Documentation

- [Specification](docs/specification.md): features, interaction rules, and ownership.
- [Development](docs/development.md): local environment, authentication, and database setup.
- [Deployment](docs/deployment.md): Vercel, production environment variables, and release checks.
- [Design](docs/design.md): Figma references and design workflow.
- [Assets](docs/assets/README.md): illustrations, logos, and social sharing image updates.
- [Notebook migration](docs/notebook-migration.md): import and verification procedures.

Use English for project documentation, code comments, and UI text. Users may write
Notes and Chat messages in any language.

## Directory structure

```text
app/          Vue pages, layouts, and middleware
server/       APIs, OAuth, and database access
shared/       Types and shared logic
prisma/       Database schema and migrations
tests/        Unit, Nuxt, and database tests
scripts/      Verification and import tools
docs/         Specification and operating guides
```
