# Figma and Implementation Workflow

## Designs

- [Figma file](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n)
- [Desktop workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=5-21)
- [Mobile workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=26-376)
- [Desktop landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=22-211)
- [Mobile landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=27-473)
- [Nuxt UI v4 reference assets](https://www.figma.com/design/UKhfIA0UGXuJHv0wNpyZW3/?node-id=3724-8039)

Figma contains static design proposals. The reference library could not be imported using published keys, so the designs use local components. There is no automatic synchronization with the implementation.

## Responsibilities

- The [specification](specification.md) is the source of truth for features, saving behavior, search, and permissions.
- Figma supports decisions about appearance, layout, and navigation.
- Record implementation status and validation results in the README and pull requests.

Update Figma when adding or removing screens or interactions, changing navigation, making substantial layout changes, or changing mobile behavior. Small spacing adjustments, minor copy edits, and hover details can be handled in code and reconciled when a feature is complete. State whether each change has been reflected in the specification, implementation, and Figma.

## Conventions shared with nuxt-chat

- Inter, a gray dark theme, and Nuxt green (primary #00c16a).
- Nuxt Note as the display name, an English interface, a 64px header, and a 28px GitHub avatar.
- A 288px desktop sidebar. Navigation uses 14px / Medium with green text and a gray background for active items.
- Bold button labels. Mobile controls provide touch targets of at least 44px.
- Bottom-align the logo and title using `align-items: flex-end` on the parent and `text-box-trim: trim-end; text-box-edge: cap alphabetic` on the title.

The initial landing page establishes the colors, structure, and copy. Product previews in Figma are editable layers and should not be embedded in the actual app as complete UI screenshots. Reconcile them with the working application after CRUD is implemented.
