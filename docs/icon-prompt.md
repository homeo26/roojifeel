# Roojifeel — App Icon Generation Prompt

Use with Midjourney, DALL·E, Ideogram, or similar. Generate at **1024×1024**
(that is what `app.json` expects for `icon`).

## Main prompt

> A modern flat app icon for a feelings journal app called "Roojifeel".
> A stylized emotion wheel: three concentric segmented rings radiating from
> a small glowing center, each segment in a vivid color of the feelings
> wheel — warm orange, magenta pink, crimson red, teal green, deep violet,
> amber brown — rendered as clean geometric arcs with thin dark gaps between
> segments. Deep space background (#0b0d12, near-black with a subtle dark
> navy vignette). A soft neon glow emanates from the wheel, with a delicate
> purple-to-teal-to-pink gradient light haze (#7c3aed → #14b8a6 → #ec4899).
> Minimalist, flat vector style with subtle depth, glassy dark UI aesthetic,
> centered composition with generous margins, no text, no letters, no
> watermark. Crisp edges, high contrast, designed to stay legible at
> 48×48 pixels. Square 1:1, 1024×1024.

## Variations (second pass)

- **Heart hybrid** — replace "a small glowing center" with
  "a small glowing heart at the center" (ties it to the journaling /
  self-care identity).
- **Partial wheel** — "only a three-quarter arc of the wheel, opening toward
  the top-right, suggesting an unfinished story" (more distinctive
  silhouette than a full circle).
- **Petal style** — "segments shaped as soft rounded petals rather than hard
  arcs, like a blooming flower of colors" (cozier, less analytical).

## Negative prompt (for models that support it)

> text, letters, words, watermark, photorealistic, 3D render, skeuomorphic,
> gradients banding, clutter, thin details, white background, borders,
> drop shadow outside canvas

## Usage notes

1. Generate at 1024×1024 with a **full-bleed background** (no transparent
   corners) — iOS applies its own squircle mask.
2. For the Android adaptive icon, keep the wheel within the inner **~66%
   safe zone** — launcher masks (circle / squircle / teardrop) crop the
   edges.
3. Drop the winner into `assets/icon.png`, then regenerate the Android
   adaptive icon layers (foreground / background / monochrome) referenced
   in `app.json`.
