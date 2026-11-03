# Landing page assets

The notebook illustration is the adopted hero artwork. It is the only retained notebook illustration in the project and in the [Figma artwork frame](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=85-1217). Superseded illustration concepts and the old desktop/mobile LP frames were deleted at the user's request. Shared components used by the current LP were retained.

## Notebook hero

### Approved notebook hero

`nuxt-note-hero.png` is a 1536 × 1024 transparent PNG edited with the built-in `image_gen.imagegen` tool using concept 12 as its target. The upper note lines move upward to reduce excess headroom, and rear cards sit slightly closer with subtle asymmetry. The design retains no pencil or bookmark: the green note highlight provides sufficient visual focus without another accessory. Desktop and mobile LP previews use this version and were visually checked. The user adopted this illustration. All other illustration concepts were removed from the Figma board and project asset directory.

Final refinement prompt:

```text
Use case: precise-object-edit.
Edit target: supplied concept 12 Nuxt Note hero, three charcoal note cards, no pencil and no bookmark.
Primary request: refine the composition as finished landing-page artwork, maintaining the same clean digital illustration identity. Do not introduce any new objects.
Specific refinements:
- Reduce the excess blank area above the front card's first note line. Move its upper two gray lines slightly upward, so the internal top and bottom margins feel balanced. Keep the central emerald highlight as the focal point.
- Make the arrangement a little more compact: tuck the rear cards slightly closer behind the front card, reducing overall horizontal spread about 8 percent. Preserve readable rear-card silhouettes.
- Introduce subtle intentional asymmetry in rear-card height and angle: left slightly higher, right slightly lower, no mirrored fan. The front card remains upright and dominant.
- Retain only soft, restrained panel shading; reduce bright edge shine and any surrounding haze so the illustration feels calm and crisp on a dark website.
Preserve: three rounded charcoal cards, fine muted outlines, simple abstract gray lines, emerald/mint highlight block, overall proportions and original visual style. Keep both pencil and bookmark ABSENT; the balanced note cards alone should carry the design. No symbols, extra decorations, text, logos or watermark.
Transparent background. Wide landscape 3:2 with comfortable surrounding padding.
```

## Chat illustration

`nuxt-chat-ai-conversations.png` reuses the existing decorative illustration from `public/ai-conversations.png` in the reference nuxt-chat repository. It connects the new landing page visually with the current Nuxt Chat landing page. The Figma source image and both repository copies are byte-identical.

The two retained assets are placed in Figma as image fills. Byte-identical production copies are served from `public/images/nuxt-note-hero.png` and `public/images/nuxt-chat-ai-conversations.png`. `public/images/preview-avatar.png` is the existing Figma sample avatar downloaded for the static product previews; it is not a live user profile. Product interface previews use editable Figma layers rather than flattened UI images.

## Figma presentation

[04 / Assets](https://www.figma.com/design/gkpXsU7QuoSzpXxo3QC99n?node-id=92-1012) presents both illustrations in equal cards with a shared dark background, outline, padding and title treatment. Each artwork is centered in the same viewport, uses Fit and retains its aspect ratio; the illustrations themselves remain transparent source assets. Notebook and AI image node IDs are preserved, and the landing-page placements are unchanged. The former section 04 containing obsolete Note references was deleted, and the current boards are numbered 01–07.
