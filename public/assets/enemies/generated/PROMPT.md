Generated with built-in imagegen, 2026-10-31.

Create a production 2D game enemy sprite sheet, transparent background. Four columns, six rows. Each row shows four subtle looping animation frames of the same full-body enemy facing left. Row 1 navy masked ninja with red scarf; row 2 mountain archer in green robes holding bow; row 3 gingerbread guard with candy cane spear; row 4 pink gummy slime; row 5 silver-purple retro robot; row 6 green alien in purple space suit. Friendly illustrated fantasy game style, shaded silhouettes readable at 80px. No text, labels or grid lines. Entire characters including weapons inside their cells.

Follow-up: remove background, preserve all 24 characters and exact positions; actual transparent alpha, no colored haze. Final source: enemy-sheet.png (1024 × 1536). RGB values beneath alpha-zero pixels retain background colors and are intentionally ignored.

Preparation: scripts/prepare_enemies.py normalizes the six rows to four 192 × 192 frames, with shared scale and aligned feet. Existing hero atlases are untouched.
