# New worlds — imagegen sources

Panoramas: two equally sized horizontal panels stacked vertically, no borders or text. Top: Russian fairy tale swamp, twisted birches, reeds, distant hut on chicken legs, teal mist, luminous fireflies. Bottom: golden desert dunes, copper sky, monumental ancient ruins and rocky mesas. Handpainted family friendly fantasy side scrolling backgrounds with horizontal walkable ground.

Sprites: four columns by four rows. Row 1: mossy stump, twisted swamp root, mushroom mound, cloudberry. Row 2: desert rock, blue spice crystals, broken sandstone column, glowing spice crystal. Row 3: kikimora, water goblin, small sandworm, robed desert guardian, facing left. Row 4: wooden moss arch, bent swamp tree, sandstone arch, desert canopy. Isolated objects with transparent background. A second background-removal edit was requested; returned source still contains a colored backdrop, so extraction requires foreground matting.

Build assets with scripts/prepare_new_worlds.py (Pillow, rembg with CPU runtime). Enemy sheets use a subtle four-frame breathing motion.
