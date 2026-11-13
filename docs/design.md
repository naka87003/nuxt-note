# Figma and Implementation Workflow

## Designs

The [Figma file](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n) contains
editable screens, interaction states, and shared components on the Production page.
It uses local components and is synchronized with the implementation manually.

Key references:

- [Workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1008)
- [Responsive layouts](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=106-1023)
- [Landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1009)
- [Agent access](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=428-4067): desktop/mobile connection instructions, collapsed/expanded Codex guide, token issuance, and deletion confirmation. Token values are placeholders.
- [Note editing and saving](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3863)
- [Chat generation and recovery](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3864)
- [Chat to Note](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3865)

## Canvas organization and review

Screens are arranged on the left, flows and states in the middle, and shared
components, assets, and Documentation on the right. Preserve existing node IDs
when reorganizing the canvas so links remain valid. Section numbers and the full
layer inventory are maintained in Figma rather than duplicated here.

Use editable layers and shared components, color/spacing variables, and text
styles. Check rendered views for overlap, clipping, and responsive layout.
The [specification](specification.md) defines behavior; avoid duplicating it on
the canvas. Exported illustrations and their usage are documented in
[asset notes](assets/README.md).

## Current workspace design

- Note reading headers place category, creation date, and last-updated time above the title, beside the Edit / Delete actions where space permits. Narrow layouts wrap metadata within the header. Landing-page Notes previews use the same arrangement without a standalone Preview label; editor Preview tabs remain unchanged.
- Desktop: a compact Notes / Chat switch pinned to the bottom of the 288px sidebar. Notes retains categories, the note list, and the reading pane. Chat uses the same category IDs, names, and ordering as Notes. All chats and Uncategorized precede the shared Categories. Filtered, date-grouped conversation history occupies its own 340px middle column, matching the Note list; the category sidebar contains no history. Switching workspaces preserves that filter; counts reflect each workspace separately.
- Mobile: the header menu opens a navigation drawer containing the same Notes / Chat switch in its bottom footer. The proposal includes note and conversation lists, reading/conversation states, and category-only drawers at 390 × 844. The conversation and New Chat have a Back control returning to the history list. Choosing a workspace or navigation item closes the drawer. The keyboard is hidden in the review states; the implementation keeps the composer above the visual viewport and safe area.
- Shared shell: both modes follow Nuxt Chat's header, sidebar, palette, button typography, selection colors, and spacing. The desktop header retains the Nuxt logo and Nuxt Note title. Below 640px the brand is hidden, matching Nuxt Chat, and the sidebar toggle and contextual create action appear on the left with the GitHub avatar on the right. Notes remains the post-login destination. Profile and sign-out behavior are shared.
- Conversation layout: the content container is capped at 800px, user messages occupy 70% of the inner width and align right, and assistant messages use plain Markdown with no added role labels or response-copy control. The Category and Delete controls use compact neutral soft buttons. The example conversation belongs to the shared Nuxt category and shows Category: Nuxt for reassignment.
- Chat input and empty state: the composer uses the background surface, a 1px outline, a 28.8px pill radius, and a circular paper-airplane send button. An empty draft has a disabled send state and no invented placeholder or helper text. New Chat shows the reference application's centered elevated Start your chat card; the first send immediately shows the question and cursor with the composer at the bottom. New and saved chats share one session view; saving updates the URL without replacing that view or its stream.
- Note layout recommendation: retain the three desktop columns for category filtering, note selection, and reading. Hide the note list during editing to widen the editor, and use separate list and reading screens on mobile. The user agreed to the shared three-column structure and the staged responsive behavior; detailed static states remain reviewable. Note reading typography, list selection colors, and create/delete actions follow the common Chat visual foundation; mobile creation appears once in the header.
- Unsaved edits: switching away from the note editor must require confirmation when changes are unsaved. Category creation, rename, and deletion affect both workspaces. Deleting a category uncategorizes both content types without deleting them. New content inherits the selected category; All creates uncategorized content.
- Workspace tabs: implement Notes / Chat with [Nuxt UI UTabs](https://ui.nuxt.com/docs/components/tabs), using `variant="pill"`, `color="primary"`, `size="sm"`, and `:content="false"`. Set `TabsItem.icon` to `i-lucide-file-text` for Notes and `i-lucide-message-circle` for Chat. The Figma switches use the dedicated Tabs component set. Match Nuxt UI's small theme: elevated list background, 4px list padding, primary indicator, 16px icons with a 6px label gap, and 12px Medium labels with 16px line height. Desktop lists are 256 × 36px with 28px triggers. Mobile controls are 288 × 44px, with a visually smaller 36px background track and 28px active indicator centered inside the 44px trigger hit area. Customize the UTabs list/indicator UI slots to achieve this separation without enlarging the visible pill or shrinking its touch targets. Normalize each icon’s nested SVG viewport to 16 × 16px; resizing only the outer icon instance is insufficient. Align the switch with the navigation content edges inside the 16px sidebar padding, in a pinned footer, with only categories scrolling independently above it; content history scrolls in the separate list. Include the bottom safe-area inset on mobile. Derive the controlled selected value from the current workspace route, and change routes only after any unsaved-edit confirmation succeeds. The Figma components represent UTabs visually; application navigation is implemented with the actual Vue component.
- Reuse and validation: the proposals reuse local header, navigation, button, and input components, existing color/spacing variables, Inter text styles, and the existing avatar image. Conversation icons use the application's Lucide SVG source. Rendered previews were checked for overlap and clipping; the boards contain editable layers rather than full-screen images.

The integrated layout is approved. The application implements category CRUD, shared navigation, scoped search, and saved Chat list/read/reassignment/deletion APIs. Saved-note editing/deletion and safe Note Markdown rendering are implemented. Chat creation, generation with a cursor, retry and safe Chat Markdown are implemented. Obsolete Note reference and landing-page frames have been removed.

## Shared responsive behavior

Notes and Chat follow the same agreed layout rules: 1280px and above show category/list/content; 768–1279px show list/content with categories in a drawer; 767px and below switch between list and content screens. At 768–959px the list narrows to 280px; at 960px and above it is 340px. Hide list / Show list provides additional reading space without changing category or selection. The [specification](specification.md#responsive-interface) defines state preservation, keyboard, safe-area, and scroll behavior.

Current desktop Chat, New Chat, category drawers, and LP Chat previews were updated in place. The responsive section adds editable 1024px Notes/Chat, list-hidden variants, medium category-drawer variants, 768px Notes/Chat, mobile Chat list, mobile Note reader, and mobile Chat reader. Shared components, existing syntax-highlighted text, palette variables, and Inter/JetBrains Mono fonts are reused. Raster content consists only of existing profile avatars, not complete UI images. The 768px header was adjusted to retain the avatar and brand; overlay dimming preserves the underlying view.

LP product previews now follow their viewport: desktop uses three-column workspaces, medium widths use two-column workspaces, and mobile uses mobile Note reading and Chat conversation screens. The application now implements these responsive columns, route changes, list toggling, and a Nuxt UI drawer with focus trapping, Escape/backdrop dismissal and safe-area spacing. The Chat implementation also supports keyboard-aware composition; physical-device behavior remains a deployment smoke check.

## Landing page

The expanded landing page combines the Nuxt Chat landing page's feature-card, AI-illustration, benefits, and call-to-action structure with the Notes-first workspace. It retains the dark palette, Nuxt green, Inter typography, and local design components. The obsolete desktop and mobile landing-page frames have been removed; current LP frames and their reusable components remain.

The page includes a notebook hero illustration, editable Notes and Chat previews, three feature cards, a Capture / Explore / Keep workflow, and a closing call to action. The adopted notebook hero uses a bookmark-free, pencil-free three-card composition with balanced upper spacing, tight overlaps, and subtly asymmetric rear cards. The green highlight remains the focal point; a bookmark is unnecessary. The user adopted this notebook illustration. All other illustration variants were deleted from the Figma board and project asset directory at the user's request. The AI section reuses the decorative AI illustration from nuxt-chat. The copy avoids unsupported user-count or security claims and does not promise automatic note-to-chat integration. Production labels such as concept/version numbers have been removed from the canvas and asset filename.

Desktop, 1024px, 768px, and mobile layouts were rendered and visually checked for overlap, clipping, and text readability. Product previews remain editable Figma layers. Mobile shows complete mobile reading/conversation viewports instead of cropped lists or scaled desktop UI. The two decorative illustrations use editable vector masters in Figma and local SVGs in the application; see [asset notes](assets/README.md).

LP responsive rules: at 1280px and above the hero and AI introduction can sit beside imagery/product views; at 768–1279px the hero and AI sections stack, using two-column application previews. Feature cards remain three across at 960px and above and stack below 960px. Navigation simplifies below 900px. Below 768px, 16px page gutters, stacked calls to action/cards, and real mobile product previews keep text readable. The decorative notebook and AI illustrations are shared across viewport sizes and keep their aspect ratios. The 1024px/768px samples use 32px page gutters.

The application now implements these landing-page compositions in `app/pages/index.vue`, with static Vue/CSS product previews in `LandingWorkspacePreview.vue`. The shared brand, Nuxt UI buttons, installed Lucide icons and palette tokens are reused. The adopted illustrations are served locally from `public/images`; product previews fetch no account data and make no AI requests. Navigation anchors open the corresponding page sections. Start and sign-in actions open `/login` for visitors or `/notes` for signed-in users. The specification and existing Figma frames continue to define the same responsive behavior; no design change was needed.

## Responsibilities

- The [specification](specification.md) is the source of truth for features, saving behavior, search, and permissions.
- Figma supports decisions about appearance, layout, and navigation.
- Record implementation status and validation results in the README and pull requests.

Update Figma when adding or removing screens or interactions, changing navigation, making substantial layout changes, or changing mobile behavior. Small spacing adjustments, minor copy edits, and hover details can be handled in code and reconciled when a feature is complete. State whether each change has been reflected in the specification, implementation, and Figma.

## Conventions shared with nuxt-chat

Code examples in the Figma Notes, Chat, Markdown editor, and LP previews use GitHub Dark syntax colors, matching nuxt-chat's `mdc.highlight.theme`. Local `syntax/github-dark/*` text-fill variables distinguish keywords, function calls, strings, comments, Markdown headings, and fences. This is illustrative static highlighting. The application shares a Comark renderer with raw HTML and authored components disabled across Notes and Chat; GitHub Dark syntax highlighting is supplied by Comark's core Shiki plugin; the Vue code-block component renders its slot and copy controls. The nuxt-chat configuration and MarkdownRenderer were checked: the same theme, local SSR/streaming operation and supported languages are retained using Comark rather than its MDC rendering pipeline.

The shared Comark parser registers its core Shiki plugin with explicit local grammar/theme imports and GitHub Dark. The plugin generates token nodes that Vue renders through the code-block slot, without `v-html` or application-managed token HTML and caching. SSR and browser rendering use the same plugin configuration. The code-block background remains the workspace muted background rather than the theme's editor background.

- Inter, a gray dark theme, and Nuxt green (primary #00c16a).
- Nuxt Note as the display name, an English interface, a 64px header, and a 28px GitHub avatar.
- A 288px desktop sidebar. Navigation uses 14px / Medium with green text and a gray background for active items.
- Bold button labels. Mobile controls provide touch targets of at least 44px.
- Bottom-align the logo and title using `align-items: flex-end` on the parent and `text-box-trim: trim-end; text-box-edge: cap alphabetic` on the title.

The initial landing page establishes the colors, structure, and copy. Product previews in Figma are editable layers and should not be embedded in the actual app as complete UI screenshots. The shared workspace and Note editor are reconciled with the working application; the redesigned landing page is implemented and visually checked at all four reference widths.

## Workspace implementation

The shared shell is implemented in `app/layouts/workspace.vue`, with CategoryNavigation, WorkspaceList and route-controlled UTabs. Breakpoints are 1280px and 768px; list widths are 340px and 280px below 960px. Category CRUD uses one API for both workspaces, preserves empty categories, and shows separate Notes/Chat counts. New and saved notes protect unsaved edits during navigation, category/workspace changes, sign-out and browser unload.

Note creation/editing/deletion, search, safe Markdown readers/previews, Chat creation/streaming/cursor/retry, and shared category operations are implemented. The sections below describe the runtime and editor contracts. Remaining work includes deployment/device validation; the README records current verification results.

## Chat runtime states

[Chat Generation and Recovery / Desktop and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=129-1543) contains editable Generating, Interrupted, Failed, and Retrying conversation-pane states using local buttons, composer, palette variables, and Inter typography. The panes belong inside the shared workspace shell. Generation uses a disabled Send button and a pulsing block cursor after the local response (static with reduced motion); there is no manual stop control. Interrupted and failed responses retain partial text and offer Try again. See the [Chat specification](specification.md#chat-creation-and-ai-generation) for generation and recovery rules.

Assistant Markdown uses the shared HTML-disabled renderer with GitHub Dark fenced-code highlighting, including incomplete streamed fences. The composer supports keyboard composition, Shift+Enter, safe areas, and visual-viewport resizing. Actual on-screen keyboard behavior on physical iOS/Android devices remains a deployment/device smoke check.

## Notes editing, preview and unsaved changes

[Notes editing / Desktop, mobile and interaction contract](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=135-1583) adapts the earlier editor to the current shared shell. It reuses local header, sidebar, workspace Tabs, buttons, text styles and palette variables. Editable desktop split, mobile Edit/Preview and an unsaved-change interaction panel are included; superseded reference layouts have been removed.

Implementation uses one NoteEditor for creation and editing, existing Nuxt UI controls and the shared Markdown renderer. Desktop offers Edit / Split view / Preview; mobile offers Edit / Preview. Editing hides the list temporarily. Title and Category share a row at widths of at least 768px (flexible Title and 256px Category) and stack on mobile. Both remain accessible in every view, and Save commits all fields together. The tab track is 36px high with 28px triggers/indicator; mobile retains 44px hit areas. Markdown input and preview have bounded, independently scrollable regions. Editor tab labels are native Auto Layout text, rather than resized Button-instance text, to keep them centered in Figma. The specification defines Cancel, navigation, sign-out, native unload, dirty comparison and retry behavior. Reader actions include Edit and confirmed permanent Delete.

Specification, code and Figma reflect this phase. Shared GitHub Dark highlighting is implemented for Note readers/previews and Chat; source editing uses a plain textarea. The existing Figma syntax variables were checked against the implementation (foreground #e1e4e8, keyword #f97583, function #b392f0, string #9ecbff). The Figma boards retain their existing illustrative code examples; no screen, layout or interaction changed. Their earlier implementation-limit annotation is historical; the specification and this document record the current behavior. Browser checks use an isolated authenticated fixture with a disposable database; no production content is modified.

## Chat to Note

The mobile action rows in the Chat-to-Note section match the implemented content-aware layout: Back, Generate draft, category and Delete stay on one row when space permits; narrower screens or long category names move category and Delete together to a second row. The mobile Category: prefix is omitted, long names truncate within the button, and actions retain 44px touch targets. [Editable 390px and 320px comparisons](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=196-1656) show both cases alongside the updated mobile flow screens.

[Chat to Note / Desktop and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=187-1299) illustrates the implemented Generate draft flow with four desktop screens and five mobile screens, reusing the workspace shells, component instances, and design tokens. It retains confirmation, loading, failure, and editor screens, plus short state labels and mobile toolbar comparisons. Duplicated behavior notes were removed from the canvas.

The [Generate a Note from Chat specification](specification.md#generate-a-note-from-chat) defines AI input/output, confirmation, generation limits, failure/retry, category inheritance, explicit saving, and unsaved-draft behavior. Maintain those rules there rather than duplicating them in this design guide or Figma.
