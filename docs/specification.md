# Nuxt Note: Initial Specification

This document is the source of truth for features and interaction rules. Visual design and screen structure are managed in [Figma](design.md). The README's Current implementation section distinguishes implemented functionality from planned features.

## Scope

- Sign in with GitHub. Only the owner can view and edit their notes and categories.
- Create, list, read, update, and delete notes.
- Edit Markdown and preview the rendered content.
- Create, rename, and delete categories.
- Search across all notes or within a category.
- Incrementally add private chat within the same application, sharing Note's categories, user, GitHub authentication, and database. Existing Chat data will not be imported. See the [integration plan](integration.md) for the foundation scope and implementation sequence.
- Support desktop and mobile. Use the display name Nuxt Note, an English interface, and a dark theme by default.

Archive, trash, tags, timelines, comments, likes, calendar, sharing, public notes, and image uploads are outside the initial scope.

Note remains the main workspace. Chat integration can proceed before all note features are complete. One shared Category model organizes notes and conversations; there is no separate Project concept. Category membership groups content by topic, without automatically sending notes to AI or linking individual notes to conversations.

## Notes and saving

- Each note has an owner, title, Markdown body, optional category, creation timestamp, and update timestamp.
- A note belongs to zero or one category. Notes without a category appear under Uncategorized.
- Save changes explicitly with Save. Prevent duplicate submissions while saving and preserve edits if saving fails.
- Ask for confirmation before navigation, category changes, or leaving the editor when there are unsaved changes.
- Replace an empty title with Untitled note when saving. Titles are limited to 200 characters.
- Permanently delete a note after confirmation from its reader. Deleted notes cannot be restored. A failed deletion keeps the note visible and offers retry.
- New and saved notes share the same editor. Edit opens a local snapshot; the reader remains the default on reload. Title, Markdown and optional category are saved together. The category selector changes only the draft and does not change the navigation filter until Save succeeds.
- Desktop/tablet editing hides the list without changing its saved visibility preference, selection, search or scroll. Edit / Split view / Preview switch the same draft; mobile offers Edit / Preview. Resizing preserves all fields. Cancel returns a saved note to its reader, or a new note to the list.
- Dirty means title, Markdown or category differs from the editor's initial snapshot; reverting all fields removes the warning. Preview changes never save or discard content. Untouched new notes can be cancelled without confirmation.
- For dirty notes, Cancel, Back, another note, category/filter navigation, workspace switching, home and sign-out use the shared Keep editing / Discard changes confirmation. Keeping edits cancels the requested action; discarding completes it. Reload/close uses the browser's native confirmation. Saving disables fields, duplicate submission, Cancel and app navigation; a save failure retains the full draft for retry.

## Categories

- Users can choose names such as English, Nuxt, and TypeScript.
- Trim surrounding whitespace. Names must contain 1–100 characters. Use an NFKC-normalized, lowercase nameKey to prevent duplicate names within a user's account.
- A note or conversation belongs to zero or one category. The same category ID, name, and ordering are used in Notes and Chat, including categories with no items in the current workspace.
- Creating or renaming a category affects both workspaces. Confirmation before category deletion must explain that both notes and conversations will become Uncategorized; neither content nor chat messages are deleted.
- A note or conversation cannot be assigned to another user's category. APIs must validate both the content owner and category owner; renaming and deletion must also be owner-scoped.
- Switching Notes / Chat preserves the selected category or the Uncategorized filter; the All view maps to All notes / All chats. Close the mobile drawer after a successful switch. Unsaved-note confirmation must succeed before changing routes or filters.
- Show counts for the active workspace only (note counts in Notes, conversation counts in Chat). Sort the shared category list by nameKey ascending, breaking ties with id, so both workspaces use the same order.
- New notes and conversations inherit the selected category, or remain Uncategorized when created from All or Uncategorized. Opening an existing conversation uses that conversation's category as the current filter. Reassignment updates categoryId only and preserves content.

## Chat creation and AI generation

- Opening New Chat creates no database records. The first non-empty send atomically saves the conversation and first user message. Inherit the selected category; All and Uncategorized create uncategorized chats. Use the first question (whitespace collapsed, up to 80 Unicode characters) as the title, without a separate AI request.
- User messages contain 1–20,000 characters after trimming; reject larger input. Enter sends, Shift+Enter inserts a newline, and Enter during IME composition never sends. Empty input disables sending. Unsent drafts are local to the current screen.
- Save the user message before starting generation. Repeated submissions with the same request/message UUID reuse the saved content. Clients cannot submit assistant messages or a replacement history.
- Generate one response per conversation at a time. A database guard enforces this across tabs/processes; concurrent requests return 409. Different conversations can generate independently. Use server-owned history from the authenticated user's conversation only; categories and notes are never attached to AI requests.
- While generating, disable input, Category and Delete in the current screen; replace Send with Stop generating. Show streamed Markdown and a Generating… status. Follow new output only while the reader remains near the bottom. Keep the composer above the mobile keyboard and safe area.
- Stop aborts the client's stream and forwards cancellation to AI. Keep the question and partial answer, mark the answer stopped, and show Response stopped. / Generate again. Persist text before publishing it so an acknowledged stop retains everything already displayed. Stop and completion racing use the first committed terminal state.
- Network/provider errors, timeouts, empty responses and output-limit termination preserve the question and partial text, mark the answer failed, and show Try again. Missing AI configuration returns 503 and leaves the saved question retryable. Do not expose provider error details or credentials.
- Retry is manual and applies only to the latest unanswered, stopped or failed question. Start a new attempt, clear and replace that question's answer in the same message slot, and never save the question again. Earlier attempts are not retained as branches. Successful responses cannot be regenerated in this phase. A new question is allowed after a stopped/failed answer; resolve a question with no answer slot through retry first.
- The next prompt includes completed/non-empty stopped exchanges and the current question; exclude failed partial exchanges and the previous answer being retried. Limit accumulated input to 100,000 characters; ask the user to start another chat when exceeded. These character limits complement the provider's model-specific context limits.
- Set a 120-second total generation timeout, 4,096 maximum output tokens, and no automatic provider retries. Use server-only OpenAI settings. Interrupted server work becomes failed on the next read/send/retry after 150 seconds; preserve its last checkpoint and allow manual retry. There is no background job or resumable stream.
- Leaving a conversation or reloading aborts its active local stream; returning reads saved state. A tab viewing another tab's active generation polls persisted state every two seconds and can stop that attempt. Late writes from a stopped/expired attempt cannot overwrite its replacement. Deleting a conversation from another tab cannot recreate it through generation.
- Assistant messages render Markdown with raw HTML disabled, safe link protocols, no remote images, and horizontally scrollable code/tables. Syntax highlighting remains a follow-up. User messages remain plain text.

## Search and lists

- Match substrings in titles and raw Markdown bodies, ignoring case.
- Treat SQL pattern characters such as `%` and `_` as literal characters.
- Clearly show whether the search covers all notes or the current category. Do not display date groups in search results.
- Sort by updatedAt descending. Break timestamp ties by id to keep ordering deterministic.
- Group lists outside search as follows, omitting empty groups.

| Label       | Time since the last update          |
| ----------- | ----------------------------------- |
| Today       | Up to 24 hours                      |
| Last 7 Days | More than 24 hours and up to 7 days |
| Last Month  | More than 7 days and up to 30 days  |
| Older       | More than 30 days                   |

These elapsed-time rules match nuxt-chat. Today does not mean since local midnight, and Last Month does not mean the previous calendar month. Compare timestamps using UTC elapsed time and display dates in the viewer's local time zone. Never send data belonging to all users to the browser to perform grouping, sorting, or searching.

## Markdown

Initially support headings, paragraphs, emphasis, lists, links, blockquotes, code blocks, and tables. Disable raw HTML and allow only safe URL protocols in links. Image uploads are outside scope. Note readers, live previews and assistant messages share the existing MarkdownIt renderer with HTML disabled; no MDC/Vue components execute from user content. Only HTTP, HTTPS, mailto, relative and anchor links are accepted. Remote Markdown images are not rendered or fetched. Code blocks and tables scroll horizontally inside their pane. Fenced code remains escaped plain text; GitHub Dark syntax highlighting is deferred for both workspaces to avoid adding a second rendering pipeline in this phase.

## Responsive interface

- Use the same category → content list → reading/conversation structure for Notes and Chat. Conversation history belongs in its own list column, not in the category sidebar or drawer.
- At 1280px and above: show the 288px category sidebar, a 340px content list, and the remaining width for the note or conversation. Each column scrolls independently; workspace Tabs stay pinned at the bottom of the category sidebar.
- At 768–1279px: hide the category sidebar behind the header toggle; keep the content list and note/conversation side by side. The list is 280px at 768–959px and 340px at 960–1279px. The category drawer overlays the content, includes workspace Tabs, and closes after selection, backdrop click, close action, or Escape.
- At 767px and below: show either the content list or the selected note/conversation, with a Back control returning to the list. Category selection remains in a drawer. Preserve the category, search, selected item, and list scroll position on returning. Editing and preview use tabs.
- Hide list / Show list controls let users expand the reading/conversation pane at widths of at least 768px. Restore the list without losing selection or scroll position. Breakpoint changes preserve route, category, search and unsaved draft; returning to a wider screen restores the appropriate columns rather than discarding state.
- While editing a note at widths of at least 768px, hide the list and use the available body area for editor/preview. Unsaved-edit confirmation must succeed before changing routes or filters. On mobile, New Chat and conversation screens also provide a return-to-list control.
- Notes categories: All notes, Uncategorized, and Categories. Chat categories: All chats, Uncategorized, and the same Categories. Date groups and search controls belong in the separate content list. Use New category in both workspaces and a Category control for conversation reassignment. New Chat shows category history alongside an unselected draft; do not highlight a saved conversation while the draft is active.
- Keep the conversation and composer centered with an 800px maximum width inside their pane, reducing internal width as needed. Long code blocks scroll horizontally inside the block. Avoid page-wide horizontal scrolling; account for the on-screen keyboard and bottom safe area on mobile.
- Display the Nuxt logo and Nuxt Note in the header, with the GitHub avatar on the right. Do not repeat the logo in the sidebar.
- Bottom-align the logo and title, trimming the text's lower whitespace.
- Navigation uses Inter 14px / Medium. Active items use primary-colored text and bg-elevated.
- Mobile controls should provide touch targets of at least 44px.

## Landing page responsiveness

Use desktop, medium, and mobile compositions rather than shrinking the complete desktop page. Product previews must follow the application layout for the viewport: three columns on desktop, two columns at medium widths, and separate mobile reading/conversation screens below 768px. Decorative artwork can be shared with preserved aspect ratio. Stack the hero and AI sections below 1280px, stack feature cards below 960px, simplify navigation below 900px, and stack the primary/secondary calls to action below 768px. Use 32px medium-width and 16px mobile page gutters. Figma includes 1440px, 1024px, 768px, and 390px examples.

## Data boundaries

- Scope every note, category, and chat API read or mutation to the session's user.id, which is the database User.id. Message access must verify ownership through the parent chat. Do not trust a userId supplied by the client.
- Return 404 without exposing content when a resource belongs to another user.
- Never expose GitHub tokens or database credentials to the client. Access Supabase only as PostgreSQL from the server.
- Enable RLS in the initial migration to prevent anonymous access if tables are exposed through the Supabase Data API. The app's GitHub session is separate from Supabase Auth, so application-level ownership checks are also required.
- Apply the same Data API protection to chat tables. During this early development phase, current Note data is disposable and the initial migration covers both notes and chat. Resetting an already-initialized database is a separate explicit operation.

## Decisions to make later

Document the production host, domain, backup policy, and pagination strategy for large note collections when implementing CRUD and choosing the deployment environment.
