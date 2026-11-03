# Nuxt Note: Initial Specification

This document is the source of truth for features and interaction rules. Visual design and screen structure are managed in [Figma](design.md). The README's Current implementation section distinguishes implemented functionality from planned features.

## Scope

- Sign in with GitHub. Only the owner can view and edit their notes and categories.
- Create, list, read, update, and delete notes.
- Edit Markdown and preview the rendered content.
- Create, rename, and delete categories.
- Search across all notes or within a category.
- Support desktop and mobile. Use the display name Nuxt Note, an English interface, and a dark theme by default.

Archive, trash, tags, timelines, comments, likes, calendar, sharing, public notes, and image uploads are outside the initial scope.

## Notes and saving

- Each note has an owner, title, Markdown body, optional category, creation timestamp, and update timestamp.
- A note belongs to zero or one category. Notes without a category appear under Uncategorized.
- Save changes explicitly with Save. Prevent duplicate submissions while saving and preserve edits if saving fails.
- Ask for confirmation before navigation, category changes, or leaving the editor when there are unsaved changes.
- Replace an empty title with Untitled note when saving. Titles are limited to 200 characters.
- Permanently delete a note after confirmation. Deleted notes cannot be restored.

## Categories

- Users can choose names such as English, Nuxt, and TypeScript.
- Trim surrounding whitespace. Names must contain 1–100 characters. Use an NFKC-normalized, lowercase nameKey to prevent duplicate names within a user's account.
- Deleting a category preserves its notes and moves them to Uncategorized.
- A note cannot be assigned to another user's category. The API must validate ownership.

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

Initially support headings, paragraphs, emphasis, lists, links, blockquotes, code blocks, and tables. Disable raw HTML and allow only safe URL protocols in links. Image uploads are outside scope. Renderer selection, sanitization, and syntax highlighting will be validated when implementing the editor.

## Responsive interface

- Desktop: category sidebar, note list, and note body. Hide the list while editing and place the editor and preview side by side.
- Mobile: separate list, reading, and editing screens. Categories use a drawer; editing and preview use tabs.
- The sidebar contains All notes, Uncategorized, and Categories. Date groups belong in the note list.
- Display the Nuxt logo and Nuxt Note in the header, with the GitHub avatar on the right. Do not repeat the logo in the sidebar.
- Bottom-align the logo and title, trimming the text's lower whitespace.
- Navigation uses Inter 14px / Medium. Active items use primary-colored text and bg-elevated.
- Mobile controls should provide touch targets of at least 44px.

## Data boundaries

- Scope every note and category API read or mutation to the session's user.id. Do not trust a userId supplied by the client.
- Return 404 without exposing content when a resource belongs to another user.
- Never expose GitHub tokens or database credentials to the client. Access Supabase only as PostgreSQL from the server.
- Enable RLS in the initial migration to prevent anonymous access if tables are exposed through the Supabase Data API. The app's GitHub session is separate from Supabase Auth, so application-level ownership checks are also required.

## Decisions to make later

Document the production host, domain, backup policy, and pagination strategy for large note collections when implementing CRUD and choosing the deployment environment.
