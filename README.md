# Nuxt Note

A Markdown note app that ports the existing notebook project to Nuxt. Its stack, colors, and UI conventions follow nuxt-chat. The interface uses English and a dark theme.

## Current implementation

- Nuxt 4 / Nuxt UI v4 / TypeScript project foundation
- Responsive landing page, sign-in page, and authenticated workspace entry
- GitHub OAuth, user registration, profile display, and sign-out foundation
- Prisma 7 / PostgreSQL models for User, Category, and Note
- Updated-date grouping with boundary tests
- Authenticated note creation, explicit saving, grouped listing, and reading saved Markdown source
- Unsaved-change confirmation when leaving a new note, and retryable save errors

Editing and deleting saved notes, rendered Markdown preview, category operations, and search are planned for the next implementation phase. The note shown on the landing page is a design preview. Actual sign-in requires an OAuth App and database configuration.

The creation and reading flow implements part of the existing specification. Its minimal responsive screens have not yet been reconciled with Figma.

## Getting started

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
pnpm db:validate
pnpm build
```

## Design and documentation

- [Specification](docs/specification.md)
- [Development and environment setup](docs/development.md)
- [Figma and implementation workflow](docs/design.md)
- [Desktop workspace designs](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=5-21)
- [Mobile workspace designs](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=26-376)
- [Desktop landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=22-211)
- [Mobile landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=27-473)

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
```
