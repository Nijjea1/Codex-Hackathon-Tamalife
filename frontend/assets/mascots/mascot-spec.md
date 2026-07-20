# Savings app mascot set — design spec

Six mascot options, same visual system so any of them (or a mix of traits) will feel consistent in the app. Each is a standalone 400x400 SVG, transparent-friendly background, single-character illustration with a drop shadow.

## Shared design language
- **Big head, chubby round body** (roughly 60/40 head-to-body ratio), stubby limbs, no visible neck.
- **Eyes**: large oval, dark fill (#2c2416), one white highlight circle (main) + one smaller secondary highlight for glassy/cute look.
- **Blush**: soft translucent ellipse pair on cheeks, ~50-55% opacity, warm pink/orange tone.
- **Line weight**: 3-3.5px strokes throughout, rounded linecaps/linejoins only.
- **Shading**: radial gradient per body (light top-left, darker bottom-right) for subtle volume — not flat.
- **Shadow**: soft drop shadow under the character (SVG `feDropShadow`, 4px blur, ~13% black) plus a flat ground ellipse.
- **Money motif**: every character carries a small money cue (coin slot, held coin, coin badge, dollar-sign etching) to reinforce the app's purpose.
- **Star mark**: a small 5-point star accent appears on 3 of the 6 (Penny, Mochi, Twinkle) as an optional "brand mark" — drop it if you want a cleaner look.

## The six options

| Name | Type | Primary color | Accent color | Hex (body) | Hex (stroke) |
|---|---|---|---|---|---|
| Penny | Piglet | Warm peach | Coral | #f4a878 → #ffd9bd | #d4836f |
| Mochi | Cat | Lavender | Plum | #d9c2f5 → #f0e4ff | #b9a0e0 |
| Twinkle | Star creature | Gold | Amber | #ffd766 → #fff3c4 | #e0a83f |
| Bucky | Coin pouch | Sage green | Forest | #93cf9d → #c8ecc8 | #7cb888 |
| Rolo | Raccoon | Warm gray | Umber | #c4b8a8 → #e8e2da | #8a7a68 |
| Sunny | Chick | Sunflower yellow | Orange | #ffd94d → #fff2b8 | #e0a83f |

All use gold `#ffe066` / `#e0a83f` for the coin accessory regardless of body color, so coins read consistently across every character.

## Files
- `penny-piglet.svg`
- `mochi-cat.svg`
- `twinkle-star.svg`
- `bucky-pouch.svg`
- `rolo-raccoon.svg`
- `sunny-chick.svg`

## Implementation notes for dev / ChatGPT handoff
- Each file is self-contained (defs + gradients + filter scoped per file) — safe to drop directly into a React/Vue component as inline SVG or import as a static asset.
- To recolor a variant, only 2 hex values need to change: the gradient stop colors and the stroke color — everything else (eyes, blush, shadow) is shared.
- For animation (idle bounce, blink, celebration), the easiest rig points are: `ellipse` eyes (blink = scaleY), whole `<g>` wrapper (bounce = translateY loop), and the coin element (spin/pulse on milestone events).
- Recommended export sizes: 400x400 source → render at 1x/2x/3x (128/256/384px) for app icons; keep as SVG for in-app illustrations to stay crisp at any size.
- Suggested use: let the user pick one mascot at onboarding, store the selection, and reuse the same character across empty states, milestone celebrations, and reminders for continuity/attachment.
