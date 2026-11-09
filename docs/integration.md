# Shared Foundation and Chat Integration

## Agreed direction

Nuxt Note is one Nuxt application centered on notes, with Chat added incrementally from the preserved nuxt-chat reference repository. Develop in nuxt-note; keep nuxt-apps as historical reference. Existing Chat users, conversations, and messages are not imported. Both apps use the same GitHub identity, session, and database within the unified application. The original Chat database and deployment remain untouched.

Notes and Chat now share **Category**. This decision supersedes the earlier separate Category / Project plan. There is no Project model or project-specific API in the target design. Sharing categories does not automatically attach notes to prompts, create note-to-chat links, or enable retrieval from notes.

## Identity and ownership

Keep Note's GitHub sign-in and upsert using GitHub numeric ID stored as User.githubId. Email is optional and is not an account-linking key. Keep session.user.id as the database User UUID, with githubLogin, name, and avatarUrl. Imported Chat code must use that UUID instead of the old Chat session.databaseUserId convention. Do not copy old OAuth handlers, sessions, secrets, or automatic demo seeding.

Server APIs use getAuthenticatedUserId from server/utils/auth.ts. It rejects missing or invalid database UUIDs with 401. Every query and mutation must filter by this owner; a missing or other owner's resource returns 404. Message access checks the parent chat. Category assignment checks both content ownership and Category.userId. Foreign keys alone do not enforce matching owners, so these checks are required before introducing category and Chat APIs.

## Shared category behavior

The [specification](specification.md#categories) defines the contract:

- One category ID and name organizes both notes and conversations. Names are unique per owner using normalized nameKey.
- Create, rename, delete, and alphabetical ordering are shared across Notes and Chat. Keep categories visible even when the current workspace has zero items there.
- Each note or conversation has an optional categoryId. Deleting a category sets both references to null and preserves notes, conversations, and messages.
- Switching workspaces preserves category / Uncategorized selection. All maps to All notes or All chats. Confirm unsaved note edits before switching.
- Counts are scoped to the active workspace. Chat history is date-grouped within the selected filter. New content inherits the selected category; All and Uncategorized create uncategorized content.
- Both workspaces use category/list/content columns at 1280px and above. At 768–1279px categories move to a drawer while list/content remain visible; below 768px list and content are separate screens. Lists can be hidden at widths of at least 768px. History belongs in the Chat list, not the category sidebar. The workspace switch stays pinned inside the category sidebar/drawer.

Figma reflects these rules in current desktop/mobile Notes and Chat, New Chat, and LP previews. The example Nuxt category contains seven notes and four conversations. Shared navigation and category operations are now implemented in the workspace foundation.

## Database foundation

The schema contains five models: User, Category, Note, Chat, and Message, plus MessageRole. Category has notes and chats relations. Chat.categoryId is optional with ON DELETE SET NULL, matching Note.categoryId. Both content models have owner/update and owner/category/update indexes. Deleting a chat cascades to messages; deleting a user cascades to owned categories, notes, and chats.

At the user's request, the early-development migration is consolidated into 20261103000000_init rather than adding a migration. It enables RLS on all five tables, with no anonymous Data API policies and no seed/import records. RLS does not replace server ownership checks because the server database role may bypass it.

**Applying this rewritten init is separate work.** An existing database that applied an earlier init, including the six-table Project version, must be reset or replaced by an empty dedicated database with fresh Prisma migration history before deploying this version. Running migrate deploy alone will not replay an applied init. Current development data is disposable, but do not reset Supabase automatically or mark a changed init applied to the old schema. No live database was changed during this update. Once the init is adopted, use new migrations for future schema changes.

## Implementation and validation

Deployment follow-up: the [2026-11-03 read-only audit](deployment.md#status-and-scope) confirmed that the locally configured target has the current init recorded with a matching checksum and RLS enabled on the five application tables. The historical reset/replacement guidance above concerns older targets only. This audit made no database changes. Vercel is the intended host; configuration and hosted validation remain pending.

The application includes the shared authentication helper, shared-category Prisma schema and consolidated init. GitHub login, persisted users, Note creation/editing/deletion, grouped listing, owner-scoped search, and safe Markdown reading/preview are implemented. Category CRUD and navigation are shared with Chat. Chat supports saved history, category reassignment, deletion, first-send creation, AI streaming with a generation cursor, partial persistence on disconnection, failure and manual retry. Opening New Chat creates no records; its first send saves the chat and question. Both workspaces now share local GitHub Dark syntax highlighting through Comark, retaining escaped code and the existing HTML/link/image restrictions.

pnpm test checks Note/authentication behavior using mocked database/session calls. pnpm test:db applies the init to isolated PostgreSQL 17 and verifies shared category identity and rename, per-owner name uniqueness, RLS, foreign keys, category deletion preserving both content types, chat/message deletion, and user deletion preserving another owner's content. The script never loads .env or contacts Supabase; it exercises direct SQL rather than Prisma migration history or live OAuth. Its readiness check uses TCP to avoid connecting to PostgreSQL's temporary initialization server.

## Subsequent implementation sequence

1. Done: category APIs and owner-isolation tests, shared navigation, responsive shell, and new-note unsaved-state handling.
2. Done: saved Chat list/read/category reassignment/deletion APIs validate chat and category ownership. Chat/message creation is now implemented with request UUIDs and ownership validation; existing Chat data is not imported.
3. Done: Chat creation, server-only OpenAI streaming, cancellation, failure/retry, partial persistence, safe Chat Markdown, and authorization. See the runtime contract in the specification.
4. Done: Note editing, deletion, search and safe Markdown rendering. Use the shared Comark renderer for readers/previews and Chat; raw HTML, executable components and remote images remain disabled. Done: shared GitHub Dark fenced-code highlighting for both workspaces, with safe plain-text fallback.
5. Configure hosting, domain, production secrets, and deployment validation for this single app.

## Chat generation implementation

Reuse the reference application's OpenAI provider through `ai` and `@ai-sdk/openai`, with `NUXT_OPENAI_API_KEY` authorized to share nuxt-chat's key. `NUXT_OPENAI_MODEL` defaults to the reference model `gpt-6.1-sol`. Keep both in private runtime config. Titles come from the first question, avoiding a second AI call. SDK settings are 120 seconds, 4,096 output tokens, `maxRetries: 0`, and OpenAI `store: false`.

The prerelease init is consolidated again at the user's request. Chat adds `generationId` and `generationStartedAt`; Message adds `status` (completed/generating/stopped/failed, checked in SQL) and a unique nullable `replyToId` for the single answer slot. Existing messages default to completed. No additional migration file is introduced, and no existing database is reset or migrated by this change. An older applied init still requires a separately authorized reset or a fresh database.

A transaction claims the chat row before creating a message or answer attempt. Checkpoint/terminal writes must still match the attempt ID. Disconnection cancels the local stream and marks the saved partial answer stopped; terminal writes release the guard, and older workers cannot overwrite a retry. There is no manual stop button or stop API. Expired attempts recover on read/send/retry. Responses use structured SSE start/text/done events; EOF alone never means successful persistence. No queue, Redis, background generation, model selector, automatic retry, AI title generation, or branching is added.

Chat runtime phase validation (before the Notes editor): 96 unit tests; disposable PostgreSQL init/RLS/uniqueness/state checks; production-build HTTP smoke tests with a fake OpenAI stream and isolated PostgreSQL for auth, create/send idempotency, generation conflicts, partial stop/save, retry in the same answer slot, provider failure, and foreign-owner rejection. A separate short request verified the authorized shared key and default model against OpenAI. Browser fixture checks cover first send, follow-up send, stop, retry and 390px/desktop layouts. Production database and live OAuth were not changed or exercised. Build the app before `pnpm test:chat`; `pnpm test:chat --preview` optionally serves an authenticated fixture on loopback port 3012 with mock AI and a temporary database.

## Notes editor implementation

One shared editor handles new/saved notes, explicit title/body/category saves, desktop split and mobile tabs. Existing route guards, unsaved-change modal, sign-out protection, shell and category APIs are reused. PATCH and DELETE always scope to the authenticated owner; category assignment validates category ownership. Update rechecks its owner-scoped write result so a concurrent deletion cannot recreate a note. No schema changes or migrations are needed.

Validation adds note mutation/ownership and Markdown protocol/HTML tests, plus disposable HTTP coverage for create/update/category/default title/delete and foreign-owner rejection. The existing Chat smoke harness exercises both workspaces. UI fixture checks cover local drafts, navigation confirmation, save/reassignment, and desktop/mobile views. See README for final check results.
