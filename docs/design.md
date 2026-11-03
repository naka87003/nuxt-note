# Figma and Implementation Workflow

## Designs

- [Figma file](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n)
- [Landing page / Desktop 1440px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=60-924)
- [Landing page / Medium 1024px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=119-1330)
- [Landing page / Medium 768px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=119-1855)
- [Landing page / Mobile 390px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=61-1093)
- [Unified workspace proposal / Desktop](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=39-776)
- [Unified workspace proposal / Mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=40-647)
- [New Chat proposal / Desktop and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=46-930)
- [Responsive layout states / 768px, 1024px and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=106-1023)
- [Nuxt UI Tabs / Workspace variants](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=49-875)
- [Desktop workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=5-21)
- [Mobile workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=26-376)
- [Nuxt UI v4 reference assets](https://www.figma.com/design/UKhfIA0UGXuJHv0wNpyZW3/?node-id=3724-8039)

Figma contains static design proposals. The reference library could not be imported using published keys, so the designs use local components. There is no automatic synchronization with the implementation.

## Canvas organization and review

The canvas is grouped into six Figma sections. Existing screen and component IDs are preserved, so direct links and component instances remain valid.

- [01 / Current workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1008): unified desktop/mobile Notes and Chat, including New Chat.
- [02 / Landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1009): desktop, 1024px, 768px, and mobile LPs with the adopted notebook illustration.
- [03 / Shared components](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1010): headers, navigation, buttons, inputs, icons, Tabs, composer, and LP feature card.
- [04 / Reference](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1011): earlier Note layouts, retained for editing and Markdown preview specifications.
- [05 / Adopted assets](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1012): the notebook hero and reused Chat AI illustration.
- [06 / Responsive variants / Medium & Mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=106-1023): supplemental 1024px two-column Notes/Chat, list-collapsed views, category drawers, 768px compact two-column views, and mobile list/reader states. See 01 / Current workspace for the base desktop and mobile screens.

Organization checks found no section-bound overflows or missing main-component references among 218 instances in the current workspace and LP boards before the shared-category update. Visual checks covered workspace and component placement.

The Note editor/preview now uses the unified shell and shared unsaved-edit confirmation; see the Notes editing board below. Chat generation, stop, failure, and retry are now defined in the specification and in the runtime-state board linked below.

The [integration plan](integration.md) establishes a single app with notes as the main workspace and chat as an additional feature. The existing Note screens, the live Nuxt Chat desktop interface, and the nuxt-chat header, sidebar, message, Markdown, and composer source have now been inspected. The unified workspace proposals include three desktop and five mobile states alongside the original designs. The user approved these designs. The shared-category navigation and responsive Notes / Chat shell are implemented; detailed Note editor states remain a separate follow-up. Chat runtime states are implemented as described below.

## Unified workspace proposal

- Desktop: a compact Notes / Chat switch pinned to the bottom of the 288px sidebar. Notes retains categories, the note list, and the reading pane. Chat uses the same category IDs, names, and ordering as Notes. All chats and Uncategorized precede the shared Categories. Filtered, date-grouped conversation history occupies its own 340px middle column, matching the Note list; the category sidebar contains no history. Switching workspaces preserves that filter; counts reflect each workspace separately.
- Mobile: the header menu opens a navigation drawer containing the same Notes / Chat switch in its bottom footer. The proposal includes note and conversation lists, reading/conversation states, and category-only drawers at 390 × 844. The conversation and New Chat have a Back control returning to the history list. Choosing a workspace or navigation item closes the drawer. The keyboard is hidden in the review states; the composer should remain above it during implementation.
- Shared shell: both modes follow Nuxt Chat's header, sidebar, palette, button typography, selection colors, and spacing. The desktop header retains the Nuxt logo and Nuxt Note title. Below 640px the brand is hidden, matching Nuxt Chat, and the sidebar toggle and contextual create action appear on the left with the GitHub avatar on the right. Notes remains the post-login destination. Profile and sign-out behavior are shared.
- Conversation layout: the content container is capped at 800px, user messages occupy 70% of the inner width and align right, and assistant messages use plain Markdown with no added role labels or response-copy control. The Category and Delete controls use compact neutral soft buttons. The example conversation belongs to the shared Nuxt category and shows Category: Nuxt for reassignment.
- Chat input and empty state: the composer uses the background surface, a 1px outline, a 28.8px pill radius, and a circular paper-airplane send button. An empty draft has a disabled send state and no invented placeholder or helper text. New Chat shows the reference application's centered elevated Start your chat card; after the first message, the composer sits at the bottom.
- Note layout recommendation: retain the three desktop columns for category filtering, note selection, and reading. Hide the note list during editing to widen the editor, and use separate list and reading screens on mobile. The user agreed to the shared three-column structure and the staged responsive behavior; detailed static states remain reviewable. Note reading typography, list selection colors, and create/delete actions follow the common Chat visual foundation; mobile creation appears once in the header.
- Unsaved edits: switching away from the note editor must require confirmation when changes are unsaved. Category creation, rename, and deletion affect both workspaces. Deleting a category uncategorizes both content types without deleting them. New content inherits the selected category; All creates uncategorized content.
- Workspace tabs: implement Notes / Chat with [Nuxt UI UTabs](https://ui.nuxt.com/docs/components/tabs), using `variant="pill"`, `color="primary"`, `size="sm"`, and `:content="false"`. Set `TabsItem.icon` to `i-lucide-file-text` for Notes and `i-lucide-message-circle` for Chat. The Figma switches use the dedicated Tabs component set. Match Nuxt UI's small theme: elevated list background, 4px list padding, primary indicator, 16px icons with a 6px label gap, and 12px Medium labels with 16px line height. Desktop lists are 256 × 36px with 28px triggers. Mobile controls are 288 × 44px, with a visually smaller 36px background track and 28px active indicator centered inside the 44px trigger hit area. Customize the UTabs list/indicator UI slots to achieve this separation without enlarging the visible pill or shrinking its touch targets. Normalize each icon’s nested SVG viewport to 16 × 16px; resizing only the outer icon instance is insufficient. Align the switch with the navigation content edges inside the 16px sidebar padding, in a pinned footer, with only categories scrolling independently above it; content history scrolls in the separate list. Include the bottom safe-area inset on mobile. Derive the controlled selected value from the current workspace route, and change routes only after any unsaved-edit confirmation succeeds. The Figma components represent UTabs visually; application navigation is implemented with the actual Vue component.
- Reuse and validation: the proposals reuse local header, navigation, button, and input components, existing color/spacing variables, Inter text styles, and the existing avatar image. Conversation icons use the application's Lucide SVG source. Rendered previews were checked for overlap and clipping; the boards contain editable layers rather than full-screen images.

The integrated layout is approved. The application implements category CRUD, shared navigation, scoped search, and saved Chat list/read/reassignment/deletion APIs. Saved-note editing/deletion and safe Note Markdown rendering are implemented. Chat creation, generation, stop/retry and safe Chat Markdown are implemented. The original Note workspace frames remain unchanged; obsolete landing-page frames have been removed.

## Shared responsive behavior

Notes and Chat follow the same agreed layout rules: 1280px and above show category/list/content; 768–1279px show list/content with categories in a drawer; 767px and below switch between list and content screens. At 768–959px the list narrows to 280px; at 960px and above it is 340px. Hide list / Show list provides additional reading space without changing category or selection. The [specification](specification.md#responsive-interface) defines state preservation, keyboard, safe-area, and scroll behavior.

Current desktop Chat, New Chat, category drawers, and LP Chat previews were updated in place. The responsive section adds editable 1024px Notes/Chat, list-hidden variants, medium category-drawer variants, 768px Notes/Chat, mobile Chat list, mobile Note reader, and mobile Chat reader. Shared components, existing syntax-highlighted text, palette variables, and Inter/JetBrains Mono fonts are reused. Raster content consists only of existing profile avatars, not complete UI images. The 768px header was adjusted to retain the avatar and brand; overlay dimming preserves the underlying view.

LP product previews now follow their viewport: desktop uses three-column workspaces, medium widths use two-column workspaces, and mobile uses mobile Note reading and Chat conversation screens. The application now implements these responsive columns, route changes, list toggling, and a Nuxt UI drawer with focus trapping, Escape/backdrop dismissal and safe-area spacing. Keyboard-aware live message composition remains part of the later AI/composer implementation.

## Landing page

The expanded landing page combines the Nuxt Chat landing page's feature-card, AI-illustration, benefits, and call-to-action structure with the Notes-first workspace. It retains the dark palette, Nuxt green, Inter typography, and local design components. The obsolete desktop and mobile landing-page frames have been removed; current LP frames and their reusable components remain.

The page includes a notebook hero illustration, editable Notes and Chat previews, three feature cards, a Capture / Explore / Keep workflow, and a closing call to action. The adopted notebook hero uses a bookmark-free, pencil-free three-card composition with balanced upper spacing, tight overlaps, and subtly asymmetric rear cards. The green highlight remains the focal point; a bookmark is unnecessary. The user adopted this notebook illustration. All other illustration variants were deleted from the Figma board and project asset directory at the user's request. The AI section reuses the decorative AI illustration from nuxt-chat. The copy avoids unsupported user-count or security claims and does not promise automatic note-to-chat integration. Production labels such as concept/version numbers have been removed from the canvas and asset filename.

Desktop, 1024px, 768px, and mobile layouts were rendered and visually checked for overlap, clipping, and text readability. Product previews remain editable Figma layers. Mobile shows complete mobile reading/conversation viewports instead of cropped lists or scaled desktop UI. The two decorative illustrations are bitmap assets; their sources and the notebook generation prompt are recorded in [asset notes](assets/README.md).

LP responsive rules: at 1280px and above the hero and AI introduction can sit beside imagery/product views; at 768–1279px the hero and AI sections stack, using two-column application previews. Feature cards remain three across at 960px and above and stack below 960px. Navigation simplifies below 900px. Below 768px, 16px page gutters, stacked calls to action/cards, and real mobile product previews keep text readable. The decorative notebook and AI illustrations are shared across viewport sizes and keep their aspect ratios. The 1024px/768px samples use 32px page gutters.

This is a Figma proposal. The application's landing page has not been changed to match it yet, and the product capabilities remain subject to the implementation status described above.

## Responsibilities

- The [specification](specification.md) is the source of truth for features, saving behavior, search, and permissions.
- Figma supports decisions about appearance, layout, and navigation.
- Record implementation status and validation results in the README and pull requests.

Update Figma when adding or removing screens or interactions, changing navigation, making substantial layout changes, or changing mobile behavior. Small spacing adjustments, minor copy edits, and hover details can be handled in code and reconciled when a feature is complete. State whether each change has been reflected in the specification, implementation, and Figma.

## Conventions shared with nuxt-chat

Code examples in the Figma Notes, Chat, Markdown editor, and LP previews use GitHub Dark syntax colors, matching nuxt-chat's `mdc.highlight.theme`. Local `syntax/github-dark/*` text-fill variables distinguish keywords, function calls, strings, comments, Markdown headings, and fences. Twenty editable text layers were updated without changing their dimensions. This is static Figma highlighting; application rendering still needs the actual MDC highlighter during implementation.

- Inter, a gray dark theme, and Nuxt green (primary #00c16a).
- Nuxt Note as the display name, an English interface, a 64px header, and a 28px GitHub avatar.
- A 288px desktop sidebar. Navigation uses 14px / Medium with green text and a gray background for active items.
- Bold button labels. Mobile controls provide touch targets of at least 44px.
- Bottom-align the logo and title using `align-items: flex-end` on the parent and `text-box-trim: trim-end; text-box-edge: cap alphabetic` on the title.

The initial landing page establishes the colors, structure, and copy. Product previews in Figma are editable layers and should not be embedded in the actual app as complete UI screenshots. Reconcile them with the working application after CRUD is implemented.

## Workspace foundation implementation

The approved designs are implemented in `app/layouts/workspace.vue`, with shared CategoryNavigation, WorkspaceList and route-controlled UTabs. Breakpoints are 1280px and 768px; list widths are 340px and 280px below 960px. Category CRUD uses one API in both workspaces, preserves empty categories, and shows separate Notes/Chat counts. Unsaved new notes guard workspace/category navigation, sign-out and browser unload.

This phase preserves raw Note Markdown reading and displays saved Chat messages as plain text. It does not add Note editing/preview, Chat creation, AI generation/stop/retry, or the landing-page redesign. The New Chat/composer design is present with sending disabled. Figma layout and the specification remain unchanged; implementation status is recorded here and in the README.

## Chat runtime states

[Chat generation, stop, failure and retry / Desktop and mobile](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=129-1543) adds editable conversation-pane states using the existing local buttons, composer, palette variables and Inter typography. The panes belong inside the adopted shared shell; they do not replace the existing workspace/New Chat boards. Generating and Retrying show Generating… and a square stop icon; Stopped preserves the partial answer and exposes Generate again; Failed preserves partial text and exposes Try again. Category and Delete are disabled during generation, while navigation remains available and aborts the local stream. The runtime board was visually checked for clipping/overlap and contains editable text/vector/component layers without complete-screen raster images.

Specification and application now implement this contract. Assistant Markdown uses a small HTML-disabled renderer; syntax highlighting remains pending. Titles use the first question rather than AI generation. The composer supports keyboard composition, Shift+Enter, safe areas, and visual-viewport resizing. Browser fixture checks verified creation, follow-up sending, stop/partial display, retry, and mobile overflow. Actual on-screen keyboard behavior on physical iOS/Android devices remains a deployment/device smoke check.

The workspace foundation section above records the earlier phase. Its disabled composer/plain-text Chat limitations are superseded by this runtime implementation; Note editing and LP status are unchanged.

## Notes editing, preview and unsaved changes

[Notes editing / Desktop, mobile and interaction contract](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=135-1583) adapts the earlier editor to the current shared shell. It reuses local header, sidebar, workspace Tabs, buttons, text styles and palette variables. Editable desktop split, mobile Edit/Preview and an unsaved-change interaction panel are included; original references are preserved.

Implementation uses one NoteEditor for creation and editing, existing Nuxt UI controls and the shared Markdown renderer. Desktop offers Edit / Split view / Preview; mobile offers Edit / Preview. Editing hides the list temporarily. Title/category fields remain accessible in every view, and Save commits all fields together. The specification defines Cancel, navigation, sign-out, native unload, dirty comparison and retry behavior. Reader actions include Edit and confirmed permanent Delete.

Specification, code and Figma reflect this phase. Syntax highlighting remains a follow-up for Note and Chat; source editing uses a plain textarea. The Figma board retains illustrative highlighted preview text from the references, and its interaction panel explicitly records the implementation limit. Browser checks use an isolated authenticated fixture with a disposable database; no production content is modified.
