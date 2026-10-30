"""Refined script to isolate, clean, and format 12 grounded overhead obstacles (4 per world).
Every obstacle is physically grounded:
- Trees have trunks touching the ground, with sweeping branches overhead and hanging hazards (lantern, sweet, scanner).
- Perched creatures (crane, marshmallow bee, drone) sit on tree boughs / gantries.
- Kites are tethered by taut strings down to stakes in the ground.
- Gates (Torii, Candy Cane Torii, Quantum Gate) have vertical pillars with overhead crossbeams.

Hanging hazards and crossbeams are positioned higher (clearance up to y=72, or 83px above floor).
Standing runner head (102px above floor, y=53) hits right in the center of the hazard band.
Ducking runner head (66px above floor, y=89) glides cleanly underneath with 17px visual clearance.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'public/assets/obstacles/overhead'
OUT_DIR.mkdir(parents=True, exist_ok=True)

SHEETS = [
    (0, '/Users/ostkost/.gemini/antigravity-cli/brain/83d5660e-ed08-43ab-947d-e08eec6e5c46/mountain_temples_obstacles_spritesheet_1793392207110.jpg', [
        ('sakura-tree-lantern', (10, 395)),
        ('pine-tree-crane', (395, 740)),
        ('dragon-kite-stake', (740, 1020)),
        ('torii-gate', (1020, 1365))
    ]),
    (1, '/Users/ostkost/.gemini/antigravity-cli/brain/83d5660e-ed08-43ab-947d-e08eec6e5c46/world2_candy_obstacles_sheet_1793392296789.jpg', [
        ('candy-tree-sweet', (20, 410)),
        ('gingerbread-tree-bee', (410, 790)),
        ('candy-kite-stake', (790, 985)),
        ('candycane-torii-gate', (985, 1350))
    ]),
    (2, '/Users/ostkost/.gemini/antigravity-cli/brain/83d5660e-ed08-43ab-947d-e08eec6e5c46/world3_cosmic_obstacles_spritesheet_1793392218295.jpg', [
        ('cosmic-pylon-scanner', (40, 380)),
        ('antenna-tower-drone', (380, 770)),
        ('orbital-probe-anchor', (770, 950)),
        ('quantum-portal-gate', (950, 1345))
    ])
]

CANVAS_W, CANVAS_H = 200, 160
FLOOR_Y = 155
# Raised hazard band:
HAZARD_TOP = 35      # 120 px above floor
HAZARD_BOTTOM = 72   # 83 px above floor
DUCK_HEAD = 89       # 66 px above floor (155 - 66)
STAND_HEAD = 53      # 102 px above floor (155 - 102)

def remove_white_bg(img_rgb):
    a = np.array(img_rgb).astype(float)
    dist = np.sqrt(np.sum((255.0 - a)**2, axis=2))
    white = dist < 26.0
    seed = np.zeros(white.shape, bool)
    seed[0, :] = white[0, :]; seed[-1, :] = white[-1, :]; seed[:, 0] = white[:, 0]; seed[:, -1] = white[:, -1]
    bg = ndi.binary_propagation(seed, mask=white)
    
    alpha = np.clip((dist - 8.0) / 22.0 * 255.0, 0, 255).astype(np.uint8)
    alpha[bg] = 0
    res = Image.fromarray(np.dstack([img_rgb, alpha]), 'RGBA')
    bbox = res.getbbox()
    return res.crop(bbox) if bbox else res

preview = Image.new('RGBA', (CANVAS_W * 4 + 50, CANVAS_H * 3 + 60), (24, 30, 42, 255))
d = ImageDraw.Draw(preview)

for level, sheet_path, variants in SHEETS:
    sheet = Image.open(sheet_path).convert('RGB')
    print(f"Processing Level {level}...")
    
    for v_idx, (name, (x1, x2)) in enumerate(variants):
        crop = sheet.crop((max(0, x1), 0, min(sheet.width, x2), sheet.height))
        rgba = remove_white_bg(crop)
        
        frame = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        
        # Scaling:
        # Width up to 180, height up to 148 so the tree/gate stands from floor (155) up to near top (10..15)
        max_w, max_h = 185, 145
        scale = min(max_w / rgba.width, max_h / rgba.height)
        new_w = max(1, int(rgba.width * scale))
        new_h = max(1, int(rgba.height * scale))
        resized = rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        pos_x = (CANVAS_W - new_w) // 2
        # Ground the object so its base meets the floor line at FLOOR_Y (155)
        pos_y = FLOOR_Y - new_h
        if pos_y < 6:
            # If slightly taller, let it reach the top
            pos_y = 6
        
        frame.alpha_composite(resized, (pos_x, pos_y))
        
        out_filename = f"level-{level}-variant-{v_idx}.png"
        frame.save(OUT_DIR / out_filename)
        print(f"  Saved {out_filename} ({name}) at ({pos_x}, {pos_y}) size={new_w}x{new_h}")
        
        # Draw on preview
        px = 10 + v_idx * (CANVAS_W + 10)
        py = 10 + level * (CANVAS_H + 15)
        # Floor line
        d.line([(px, py + FLOOR_Y), (px + CANVAS_W, py + FLOOR_Y)], fill=(80, 160, 100), width=2)
        # Hazard zone lines (raised)
        d.line([(px, py + HAZARD_BOTTOM), (px + CANVAS_W, py + HAZARD_BOTTOM)], fill=(230, 70, 70, 140), width=1)
        d.line([(px, py + HAZARD_TOP), (px + CANVAS_W, py + HAZARD_TOP)], fill=(230, 70, 70, 140), width=1)
        # Duck clearance guide
        d.line([(px, py + DUCK_HEAD), (px + CANVAS_W, py + DUCK_HEAD)], fill=(80, 210, 240, 140), width=1)
        # Standing head line
        d.line([(px, py + STAND_HEAD), (px + CANVAS_W, py + STAND_HEAD)], fill=(255, 180, 40, 120), width=1)
        
        preview.alpha_composite(frame, (px, py))
        d.text((px + 5, py + 5), f"L{level} V{v_idx}: {name}", fill=(240, 240, 240))

preview_path = ROOT / 'public/assets/obstacles/overhead-preview.png'
preview.save(preview_path)
print(f"All 12 obstacles processed. Preview saved to {preview_path}")
