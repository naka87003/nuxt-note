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
- Replace an empty title with Untitled note when saving. Titles are limited to 50 characters and Markdown bodies to 5,000 characters.
- Permanently delete a note after confirmation from its reader. Deleted notes cannot be restored. A failed deletion keeps the note visible and offers retry.
- New and saved notes share the same editor. Edit opens a local snapshot; the reader remains the default on reload. Title, Markdown and optional category are saved together. The category selector changes only the draft and does not change the navigation filter until Save succeeds.
- Desktop/tablet editing hides the list without changing its saved visibility preference, selection, search or scroll. Edit / Split view / Preview switch the same draft; mobile offers Edit / Preview. Resizing preserves all fields. Cancel returns a saved note to its reader, or a new note to the list.
- Dirty means title, Markdown or category differs from the editor's initial snapshot; reverting all fields removes the warning. Preview changes never save or discard content. Untouched new notes can be cancelled without confirmation.
- For dirty notes, Cancel, Back, another note, category/filter navigation, workspace switching, home and sign-out use the shared Keep editing / Discard changes confirmation. Keeping edits cancels the requested action; discarding completes it. Reload/close uses the browser's native confirmation. Saving disables fields, duplicate submission, Cancel and app navigation; a save failure retains the full draft for retry.

## Input limits

- Share limits between forms and APIs: category names 20, Note titles 50, search queries 50, user Chat messages 2,000, and Note Markdown bodies 5,000.
- Count UTF-16 code units, matching HTML maxlength and JavaScript String.length. Ordinary Japanese characters count as one; supplementary characters such as many emoji count as two. Whitespace and Markdown syntax count toward the limit before trimming.
- Display the current count and limit for category names, Note titles and Note Markdown bodies. Do not display counters for search queries or Chat messages. Reject oversized API input with HTTP 400.
- Preserve existing data without truncation or a schema migration. Oversized existing Notes remain readable; editing shows an explanation and saving requires shortening the title/body to the new limits. Existing categories can still be selected or deleted; renaming requires a name within the new limit.

## Categories

- Users can choose names such as English, Nuxt, and TypeScript.
- Trim surrounding whitespace. Names must be non-empty after trimming and input must not exceed 20 characters. Use an NFKC-normalized, lowercase nameKey to prevent duplicate names within a user's account.
- A note or conversation belongs to zero or one category. The same category ID, name, and ordering are used in Notes and Chat, including categories with no items in the current workspace.
- Creating or renaming a category affects both workspaces. Confirmation before category deletion must explain that both notes and conversations will become Uncategorized; neither content nor chat messages are deleted.
- A note or conversation cannot be assigned to another user's category. APIs must validate both the content owner and category owner; renaming and deletion must also be owner-scoped.
- Switching Notes / Chat preserves the selected category or the Uncategorized filter; the All view maps to All notes / All chats. Close the mobile drawer after a successful switch. Unsaved-note confirmation must succeed before changing routes or filters.
- Show counts for the active workspace only (note counts in Notes, conversation counts in Chat). Sort the shared category list by nameKey ascending, breaking ties with id, so both workspaces use the same order.
- Header New note / New Chat starts in Uncategorized. Creation from a list or Notes empty state inherits its category; All and Uncategorized create uncategorized items. Opening an existing conversation uses that conversation's category as the current filter. Reassignment updates categoryId only and preserves content.

## Chat creation and AI generation

- Opening New Chat creates no database records. The first non-empty send atomically saves the conversation and first user message. The creation destination determines its category: header / All / Uncategorized create uncategorized chats, and a category list creates within that category. Use the first question (whitespace collapsed, up to 80 Unicode characters) as the title, without a separate AI request.
- User messages must be non-empty after trimming and input must not exceed 2,000 characters; reject larger input. Enter sends, Shift+Enter inserts a newline, and Enter during IME composition never sends. Empty input disables sending. Unsent drafts are local to the current screen.
- Save the user message before starting generation. Repeated submissions with the same request/message UUID reuse the saved content. Clients cannot submit assistant messages or a replacement history.
- Display a submitted question immediately and clear the composer while it saves. On save failure, remove the optimistic message, restore the draft, and reuse its UUID on retry. Start generation after saving without reloading the conversation. New and saved chats use one session view. The first send immediately replaces the empty state with the question and cursor; saving updates the URL with replace while preserving that view and its stream, without waiting for sidebar refreshes or navigation. Navigating to another chat or from a conversation to New Chat starts a fresh session and aborts the previous local stream. If creation fails, restore the empty state and draft and reuse both the chat and message UUIDs on retry. Leaving during creation prevents a late acknowledgement from navigating back or starting generation. Completed streams enable the next send without a history/sidebar reload; failures and interrupted streams reload persisted partial state.
- Generate one response per conversation at a time. A database guard enforces this across tabs/processes; concurrent requests return 409. Different conversations can generate independently. Use server-owned history from the authenticated user's conversation only; categories and notes are never attached to AI requests.
- Shared category operations may refresh all workspace data. A new session must not fetch the chat-list endpoint as a conversation. Global refreshes preserve optimistic questions and active local streams; snapshots requested before a send cannot replace its output even if they arrive after completion. Explicit failure recovery still reloads the saved partial state.
- While generating, disable input, Category and Delete in the current screen; keep Send disabled. Show a pulsing block cursor from submission through message persistence and the local response, including the wait for the first text, with an accessible generation status. New-chat creation shows the same cursor alongside the optimistic question while saving. Follow cursor and empty response-slot additions as well as streamed Markdown when near the bottom. After successful completion, keep the cursor visible for another 250ms without delaying the next send; failures and interruptions clear it immediately. Respect reduced-motion preferences. Follow new output only while the reader remains near the bottom. Keep the composer above the mobile keyboard and safe area.
- There is no manual stop button or stop API. Navigation or disconnection cancels the local stream and forwards cancellation to AI. Keep the question and partial answer; the internal stopped state shows an interrupted-connection message and Try again. Send each provider text delta immediately, without waiting for database persistence.
- Checkpoint partial answers independently of text delivery on a 100ms cadence, with at most one checkpoint in flight. Coalesce new text during database waits and drain the checkpoint before terminal persistence. Await each text delivery to preserve ordering and network backpressure. Completion is announced only after terminal persistence. Disconnection saves the accumulated partial answer; abrupt process termination can lose text delivered since the last successful checkpoint.
- Save and publish the first text immediately, then check for pending text every 100 milliseconds. Idle ticks do no database work; busy ticks wait for the next tick rather than overlap writes. Flush remaining text immediately at the end. Keep the composer busy until generation and any failure-state reload settle.
- Announce completion only after the terminal state was saved by the attempt that still owns generation. If the attempt was stopped, expired or replaced, close without a completion event so the client reloads persisted state.
- Network/provider errors, timeouts, empty responses and output-limit termination preserve the question and partial text, mark the answer failed, and show Try again. Missing AI configuration returns 503 and leaves the saved question retryable. Do not expose provider error details or credentials.
- Retry is manual and applies only to the latest unanswered, stopped or failed question. Start a new attempt, clear and replace that question's answer in the same message slot, and never save the question again. Earlier attempts are not retained as branches. Successful responses cannot be regenerated in this phase. A new question is allowed after a stopped/failed answer; resolve a question with no answer slot through retry first.
- The next prompt includes completed/non-empty stopped exchanges and the current question; exclude failed partial exchanges and the previous answer being retried. Limit accumulated input to 100,000 characters; ask the user to start another chat when exceeded. These character limits complement the provider's model-specific context limits.
- Set a 120-second total generation timeout, 4,096 maximum output tokens, and no automatic provider retries. Use server-only OpenAI settings. Interrupted server work becomes failed on the next read/send/retry after 150 seconds; preserve its last checkpoint and allow manual retry. There is no background job or resumable stream.
- Leaving a conversation or reloading aborts its active local stream; returning reads saved state. Only the tab that owns the local stream shows the generation cursor. Other tabs show a saved snapshot without polling or remote-stop controls; reload to check for updates. A persisted active generation still blocks sending/retrying and conversation mutations in other tabs. Late writes from a stopped/expired attempt cannot overwrite its replacement. Deleting a conversation from another tab cannot recreate it through generation.
- Assistant messages render Markdown with raw HTML disabled, safe link protocols, no remote images, and horizontally scrollable code/tables. Fenced code uses the shared GitHub Dark highlighter, including incomplete fences during streaming. User messages remain plain text.

## Generate a Note from Chat

- Show a conversation-level Generate note action for saved chats with a non-empty completed assistant response. Disable it while a chat response or Note draft is being generated.
- First show “Generate a note from this chat?” with Cancel and Generate. Cancel, Escape and backdrop dismissal start no AI work. Confirming starts a non-dismissible loading dialog without Cancel or close controls; prevent duplicate submissions.
- On mobile, omit the Category: prefix visually while retaining the accessible label. Keep Generate note, category and Delete on one row when they fit; otherwise move category and Delete together to the second row. Truncate exceptionally long category names inside the button to prevent a third row or horizontal overflow. Preserve 44px touch targets.
- The authenticated draft API reads only the owner's saved conversation. Include all non-empty user questions and completed assistant responses in chronological order; exclude stopped, failed and generating assistant responses. Categories and other Notes are not included. Reject active chat generation and conversations exceeding 100,000 UTF-16 code units of input, without silently omitting earlier history.
- Generate an independent title (at most 50 UTF-16 code units) and Markdown body (at most 3,000 Unicode code points and 5,000 UTF-16 code units, including Markdown syntax and newlines). Use the conversation's language, appropriate headings, conclusions, reasons, steps and useful code. Reflect final corrections, identify unresolved matters, omit greetings, and add no information absent from the conversation.
- Ask AI to shorten oversized output once. Validate both limits on the server; never cut off the Markdown or accept an incomplete provider response. Use an 8,192-token cap per attempt, no automatic provider retries, a shared 120-second timeout across both attempts, and server-only OpenAI settings with `store: false`.
- Failure or timeout releases the loading state and offers Back to chat / Try again. Preserve the conversation and create no Note. Reloading or leaving offers no background continuation or restoration; ignore late results. The user can press Generate note again after returning.
- On success, hand the draft to the existing new-note editor in memory, inheriting Chat's category. Do not persist a Note until Save. The title, Markdown and category remain editable; manual edits use the 5,000-character body limit. Even an untouched AI draft counts as unsaved and uses the existing Keep editing / Discard changes flow. Cancel returns to the originating Chat after confirmation. Save failures retain the draft.
- Save creates an ordinary independent Note. Store no source-chat relationship or backlink, and provide no automatic synchronization or overwrite of an existing Note. No schema migration is required.

## Search and lists

- Match substrings in note titles and raw Markdown bodies, or chat titles and message bodies, ignoring case.
- Treat SQL pattern characters such as `%` and `_` as literal characters.
- Notes and Chat always search within the selected category (including Uncategorized); selecting All notes / All chats in the sidebar searches across all categories. There are no separate search-scope buttons. Changing the category preserves the search text. The search placeholder identifies the selected category when searching within it.
- Keep search text separately for Notes and Chat. Re-run the current search when the category changes.
- Use `Search notes…` / `Search chats…` for All, `Search in Nuxt…` for a category named Nuxt, and `Search in Uncategorized…` for Uncategorized. Apply the same search-scope rules on desktop, medium and mobile layouts, including landing-page previews.
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

Initially support headings, paragraphs, emphasis, lists, links, blockquotes, code blocks, and tables. Disable raw HTML and allow only safe URL protocols in links. Image uploads are outside scope. Note readers, live previews and assistant messages share the Comark renderer with HTML and authored component/attribute extensions disabled; no MDC/Vue components execute from user content. Only HTTP, HTTPS, mailto, relative and anchor links are accepted. Remote Markdown images are not rendered or fetched. Code blocks and tables scroll horizontally inside their pane. Fenced code uses Comark's core Shiki plugin with local language imports with the GitHub Dark theme, matching the Figma syntax variables and nuxt-chat. Highlighted token nodes are rendered by Vue through the code-block slot; application code does not generate token HTML or use `v-html`. The existing code-block background and horizontal scrolling remain. Supported languages are JavaScript/JSX, TypeScript/TSX, Vue, HTML, CSS, JSON, Bash, Markdown/MDC, YAML, PHP/Blade, SQL, Python and Diff, including bundled aliases such as js, ts, sh, md, yml and py. Language-name handling and plain-text fallback follow the Shiki plugin defaults without application-specific case normalization, caching or code-length cutoffs. Inline code remains plain text; untyped blocks render without language detection. No highlighting API or runtime language download is used. Source editing continues to use a plain textarea. Single newlines use standard Markdown paragraph wrapping; two trailing spaces or a backslash create an explicit line break.

## Responsive interface

- Use the same category → content list → reading/conversation structure for Notes and Chat. Conversation history belongs in its own list column, not in the category sidebar or drawer.
- At 1280px and above: show the 288px category sidebar, a 340px content list, and the remaining width for the note or conversation. Each column scrolls independently; workspace Tabs stay pinned at the bottom of the category sidebar.
- At 768–1279px: hide the category sidebar behind the header toggle; keep the content list and note/conversation side by side. The list is 280px at 768–959px and 340px at 960–1279px. The category drawer overlays the content, includes workspace Tabs, and closes after selection, backdrop click, close action, or Escape.
- At 767px and below: show either the content list or the selected note/conversation, with a Back control returning to the list. Category selection remains in a drawer. Preserve the category, search, selected item, and list scroll position on returning. Editing and preview use tabs.
- Hide list / Show list controls let users expand the reading/conversation pane at widths of at least 768px. Restore the list without losing selection or scroll position. Breakpoint changes preserve route, category, search and unsaved draft; returning to a wider screen restores the appropriate columns rather than discarding state.
- Editor Title and Category share a row at widths of at least 768px; the category field is 256px and the title takes the remaining width. Below 768px they stack. Desktop editor tabs use 28px triggers inside a 36px track; mobile keeps 44px hit areas around the compact visual pill. Markdown input and preview scroll within bounded panes and must not extend outside them.
- While editing a note at widths of at least 768px, hide the list and use the available body area for editor/preview. Unsaved-edit confirmation must succeed before changing routes or filters. On mobile, New Chat and conversation screens also provide a return-to-list control.
- Notes categories: All notes, Uncategorized, and Categories. Chat categories: All chats, Uncategorized, and the same Categories. Date groups and search controls belong in the separate content list. Use New category in both workspaces and a Category control for conversation reassignment. New Chat shows category history alongside an unselected draft; do not highlight a saved conversation while the draft is active.
- Always show the header New note / New Chat, linking to Uncategorized. The list's creation action uses Uncategorized for All / Uncategorized and the selected category for a category list. Whenever the list is visible, always show its New note / New Chat action, including All / Uncategorized and new-chat screens, at every viewport size. Creation controls use ordinary links; clicking while already at the destination does not reset the current draft. Notes creation and editing keep their existing editor layout and confirmation behavior.
- List headings place the category name on the first row with an icon-only Hide list control (`panel-left-close`) at its right edge, and item count / creation controls on the second row. The Hide list icon has a tooltip and accessible label and remains hidden below 768px. Names use their actual height, up to two lines, with the full name available on hover; sidebar category names truncate to one line. Keep buttons from shrinking and mobile touch targets at least 44px.
- Notes empty state keeps the notebook-pen icon and always says “Your new note starts here.” Its subtitle is “Select a note or create a new one.” and its New note follows the list's creation destination. Chat's empty card always says “Start your chat”, with no period or subtitle. When creating within a category, show a non-interactive folder badge with the category name at the top right of the conversation pane on desktop and mobile, outside the centered card. All / Uncategorized omit the badge. Truncate long badge labels and expose the full category name via a tooltip and accessible label; leave space for the mobile Back control. The badge must not change the card's content height or vertical centering.
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
