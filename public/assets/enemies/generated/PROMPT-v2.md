# Enemy animation v2
Generated with built-in ImageGen, 2026-10-31. Source: enemy-sheet-v2.png.

Prompt: Transparent production sprite sheet, exactly seven columns and ten rows. Rows: navy ninja red scarf katana, green medieval archer, gingerbread guard, pink jelly slime, small silver robot, purple alien, swamp kikimora green hair, blue water goblin, golden sandworm, Egyptian desert guard. Columns 1–4 distinct walking/idle poses; 5 stagger backward; 6 falling sideways; 7 lying on floor. Hand painted fantasy platformer, cute expressive nonviolent art, consistent appearance, feet aligned near cell bottom, no text or grid.

Rebuild: `python scripts/prepare_combat_v2.py` (Pillow). Explicit row boundaries account for unequal gutters in the generated source. Originals remain available; new resources use -v2 filenames.
