# Landing page assets

The LP uses editable SVG illustrations created in Figma from the original PNG artwork.

## Notebook hero

The adopted notebook illustration contains three rounded charcoal cards, muted text lines and a theme-colored highlight. The Figma master is [Notebook hero](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=238-1934).

The exported asset is `public/images/nuxt-note-hero-vector.svg`. The LP renders `app/components/LandingNoteIllustration.vue` inline so accent fills inherit `--ui-primary`.

## AI conversations

The adopted AI illustration traces the original artwork's curves, nodes and central lettering. The Figma master is [AI conversations](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=238-2030).

The exported asset is `public/images/nuxt-chat-ai-conversations-vector.svg`. The LP renders `app/components/LandingAiIllustration.vue` inline so accent fills inherit `--ui-primary`.

## Figma presentation

[09 / Resources / Brand Assets and Illustrations](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=238-1888) contains both masters and their preview. All four responsive LP frames use instances of these components.

The original illustration PNGs and the Figma comparison section were deleted at the user's request. `public/images/preview-avatar.png` supplies the sample avatar used in product previews.

## Logo assets

The Assets section contains the Nuxt Note SVG logo and standalone Nuxt symbol. The wordmark uses the same Inter Bold outlines as `AppBrand.vue`. Symbol and Note fills bind to `--ui-primary`. LP headers and footers and shared workspace headers use the logo component. A shared palette button component supplies the theme picker trigger in LP and workspace headers.
