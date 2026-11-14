# Figma and Implementation Workflow

## Designs

The [Figma file](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n) contains
editable screens, interaction states, and shared components on the Production page.
It uses local components and is synchronized with the implementation manually.

- [Workspace](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1008)
- [Responsive layouts](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=106-1023)
- [Landing page](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1009)
- [Landing page: desktop](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=475-4705), [1024px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=514-4789), [768px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=514-5326), [390px](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=514-5855) on the Production page
- [Agent access](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=428-4067)
- [Note editing and saving](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3863)
- [Chat generation and recovery](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3864)
- [Chat to Note](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=364-3865)
- [Chat-to-Note mobile toolbar comparisons](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=196-1656)

## Responsibilities

- The [specification](specification.md) defines features, interactions, and permissions.
- Figma defines appearance and layout. Keep screen inventories and measurements there.
- [Asset notes](assets/README.md) describe illustration, logo, and social image exports.
- Record change-specific implementation and verification results in pull requests.
  Keep documentation focused on current behavior and repeatable procedures.

Update Figma when screens, interactions, navigation, major layouts, or mobile
behavior change. Small spacing, copy, and hover changes can be reconciled when
the feature is complete. State in the pull request whether the specification,
implementation, and Figma need updates and which have been updated.

## Canvas organization and review

Arrange screens on the left, flows and states in the middle, and shared components,
assets, and Documentation on the right. Preserve node IDs when reorganizing so
links remain valid. Use editable layers, shared components, and color/spacing/text
styles. Use placeholders for account data and tokens.

Render desktop, medium, and mobile views to check overlap, clipping, text, and
navigation. Use the [responsive specification](specification.md#responsive-interface)
for breakpoints and state preservation. Product previews should use editable UI
layers in Figma and Vue/CSS in the app, with the appropriate viewport layout.
Decorative artwork can use exported SVGs. Preview components fetch no account data
and make no AI requests.

## Visual conventions

- Inter, a dark gray palette, and Nuxt green (`#00c16a`). Reuse the application's
  Nuxt UI controls, Lucide icons, and palette tokens.
- A 64px header, 28px GitHub avatar, and 288px desktop category sidebar.
  Bottom-align the brand symbol and title, trimming lower text whitespace.
- Navigation uses Inter 14px / Medium; active items use primary text and an
  elevated background. Use bold button labels and at least 44px mobile touch targets.
- Pin Notes / Chat tabs to the navigation footer with bottom safe-area spacing;
  only categories scroll above them. Use Nuxt UI `UTabs` with `variant="pill"`,
  `color="primary"`, `size="sm"`, and `:content="false"`.
- Tabs have a 36px visual track, 28px triggers, 16px icons, and 12px Medium labels.
  Preserve 44px mobile hit areas independently of the visual track. Derive the
  active tab from the route and respect unsaved-edit confirmation before navigation.
- Use GitHub Dark syntax colors for illustrative code, bound to local
  `syntax/github-dark/*` variables. The application uses the shared Comark renderer;
  source editing uses a plain textarea. See the [Markdown specification](specification.md#markdown).

Keep detailed behavior in the specification rather than repeating it on the canvas
or in this guide. Use the [visual testing guide](visual-testing.md) for regression
checks and the [deployment guide](deployment.md#deployment-verification) for
hosted/device checks, including on-screen keyboards and safe areas.
