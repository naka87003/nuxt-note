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

Figma reflects these rules in current desktop/mobile Notes and Chat, New Chat, and LP previews. The example Nuxt category contains seven notes and four conversations. Actual navigation and category operations still require implementation.

## Database foundation

The schema contains five models: User, Category, Note, Chat, and Message, plus MessageRole. Category has notes and chats relations. Chat.categoryId is optional with ON DELETE SET NULL, matching Note.categoryId. Both content models have owner/update and owner/category/update indexes. Deleting a chat cascades to messages; deleting a user cascades to owned categories, notes, and chats.

At the user's request, the early-development migration is consolidated into 20261103000000_init rather than adding a migration. It enables RLS on all five tables, with no anonymous Data API policies and no seed/import records. RLS does not replace server ownership checks because the server database role may bypass it.

**Applying this rewritten init is separate work.** An existing database that applied an earlier init, including the six-table Project version, must be reset or replaced by an empty dedicated database with fresh Prisma migration history before deploying this version. Running migrate deploy alone will not replay an applied init. Current development data is disposable, but do not reset Supabase automatically or mark a changed init applied to the old schema. No live database was changed during this update. Once the init is adopted, use new migrations for future schema changes.

## Implementation and validation

The local foundation includes the shared authentication helper used by existing Note APIs, the shared-category Prisma schema, and the consolidated init. GitHub login, persisted users, note creation, grouped listing, raw Markdown reading, and sign-out remain the baseline. Category CRUD, shared-category navigation, saved-note editing/deletion, search, Chat endpoints, and AI streaming remain pending.

pnpm test checks Note/authentication behavior using mocked database/session calls. pnpm test:db applies the init to isolated PostgreSQL 17 and verifies shared category identity and rename, per-owner name uniqueness, RLS, foreign keys, category deletion preserving both content types, chat/message deletion, and user deletion preserving another owner's content. The script never loads .env or contacts Supabase; it exercises direct SQL rather than Prisma migration history or live OAuth. Its readiness check uses TCP to avoid connecting to PostgreSQL's temporary initialization server.

## Subsequent implementation sequence

1. Implement category APIs and owner-isolation tests, then shared category navigation and editor unsaved-state handling.
2. Port Chat APIs, replacing projectId with categoryId and validating both chat and category ownership. Test assignment, reassignment, and deletion across owners.
3. Port Chat UI and AI generation/streaming. Verify cancellation, failure/retry, persistence, and authorization.
4. Complete Note editing, deletion, search, and safe MDC rendering. Highlighting follows the reference GitHub Dark theme.
5. Configure hosting, domain, production secrets, and deployment validation for this single app.
