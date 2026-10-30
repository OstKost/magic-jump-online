# Clean animation sheets

Created with built-in image_gen. Style/identity references: original Sofia and Stella atlas.png. Final transparent source sheets are sofia-clean-sheet.png and stella-clean-sheet.png. The returned sheets are 1254 × 1254; packing finds empty row/column gutters instead of assuming the requested dimensions.

## Shared exact prompt

Use case: identity-preserve / game animation production. Reference image: existing game atlas; preserve character identity, face, hairstyle, costume and hand-painted chibi ink-outline art style. Produce REPLACEMENT CLEAN animation sprite sheet 1536x1536, EXACT regular 4 columns x 4 rows of equal 384x384 cells. Transparent background. Exactly ONE full-body character in each cell, all facing RIGHT in side view. Same physical character size in every cell, body centered horizontally, soles at 90% of cell height except airborne pose whose lowest foot also aligned to that baseline; plenty of transparent padding on every side. No text, no grid lines, no shadows, no ground, NO particle effects, no water, fire, splashes, speed streaks, symbols, speech bubbles, stars or disconnected pieces. Clean anti-aliased edges.
Cells row-major:
Row 1 and Row 2 = EIGHT successive phases of one complete RUN cycle, visibly moving BOTH legs with correct alternation! Frame1 right foot forward contact / left leg back; frame2 right leg loaded support / left knee moving through; frame3 right foot pushing off behind / left knee forward; frame4 airborne left leg extending front / right bent behind; frame5 LEFT foot forward contact / RIGHT leg back (opposite of frame1); frame6 left leg loaded support / right knee moving through; frame7 left foot pushing off behind / right knee forward; frame8 airborne right leg extending front / left bent behind. Arms counter-swing; silhouette MUST change between frames. NOT eight copies of the same running pose. Consistent head and torso, tiny bob only. Both legs and boots always visible, no extra limbs.
Row3: jump takeoff, jump apex knees tucked, jump landing, standing idle.
Row4: crouch low with knees bent, low forward slide, very low slide with front leg extended, fallen on side hurt pose.
Keep these EXACT 16 cells, no extra characters, no outlines touching cell edges.

## Sofia suffix

Character: Sofia, blue-white water martial artist girl with brown braided ponytail. Keep blue-white costume and braid. No elemental effects.

## Stella suffix

Character: Stella, red and black fire martial artist girl with long flowing brown hair and blunt bangs. Preserve red costume, black trousers, hair and waist ornaments. No elemental effects.
