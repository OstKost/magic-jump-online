"""Extract clean, high-resolution, perfectly-centered character selection avatars from pics/ master sheets.
Requires Pillow, OpenCV, NumPy.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/characters'

# 1. Clean small UI emblems from sp1 (Sofia & Stella) using seamless inpainting
sp1 = cv2.imread(str(ROOT / 'pics/sprite.png'))
y_idx, x_idx = np.ogrid[:sp1.shape[0], :sp1.shape[1]]
b, g, r = sp1[:,:,0], sp1[:,:,1], sp1[:,:,2]

mask = np.zeros(sp1.shape[:2], dtype=np.uint8)
box_sofia = (y_idx >= 15) & (y_idx <= 85) & (x_idx >= 95) & (x_idx <= 185)
emblem_sofia = ((b > 90) & (r < 75) & (g < 115) | (b > 130) & (g > 130) & (r > 130)) & box_sofia & (x_idx <= 175)
mask[emblem_sofia] = 255

box_stella = (y_idx >= 455) & (y_idx <= 555) & (x_idx >= 95) & (x_idx <= 185)
emblem_stella = ((r > 130) & (b < 95) & (g < 95) | (r > 170) & (g > 170)) & box_stella & (x_idx <= 175)
mask[emblem_stella] = 255

mask_dilated = cv2.dilate(mask, np.ones((5,5), np.uint8), iterations=2)
sp1_clean = cv2.inpaint(sp1, mask_dilated, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

sp1_pil = Image.fromarray(cv2.cvtColor(sp1_clean, cv2.COLOR_BGR2RGB))
sp2_pil = Image.open(ROOT / 'pics/ sprite-2.png').convert('RGB')

# Calibrated crop boxes:
# - Nose / facial symmetry axis perfectly at x = 128.00
# - Nose level at y = 118..119
# - Top of hair with comfortable ~25px breathing room from circular rim
# - Chin grounded at y ~ 155
# - Head height normalized across all 4 characters to 130px (50% of frame)
boxes = {
    'sofia': (44.0, 35.0, 326.0, 317.0),
    'stella': (81.5, 514.0, 298.5, 731.0),
    'air': (88.5, 205.0, 291.5, 408.0),
    'earth': (1003.5, 186.5, 1200.5, 383.5),
}

TARGET_SIZE = (256, 256)
avatars = {}

for name, box in boxes.items():
    src_img = sp1_pil if name in ['sofia', 'stella'] else sp2_pil
    crop = src_img.crop(box)
    avatar = crop.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    avatars[name] = avatar
    
    folder = OUT / name
    folder.mkdir(parents=True, exist_ok=True)
    out_path = folder / 'avatar.png'
    avatar.save(out_path, format='PNG', optimize=True)
    print(f'Saved avatar for {name}: {out_path} ({avatar.size})')

# Create comparison and QA preview
preview = Image.new('RGBA', (256 * 4 + 50, 256 * 2 + 30), (18, 37, 51, 255))
mask = Image.new('L', (256, 256), 0)
d = ImageDraw.Draw(mask)
d.ellipse((0, 0, 256, 256), fill=255)

colors = [(113, 204, 232), (239, 170, 118), (162, 224, 218), (169, 199, 140)]

for i, (name, im) in enumerate(avatars.items()):
    # Row 1: square
    preview.paste(im, (10 + i * 266, 10))
    # Row 2: circular avatar with hero ring
    circ = Image.new('RGBA', (256, 256), (0,0,0,0))
    circ.paste(im, (0, 0), mask)
    d_ring = ImageDraw.Draw(circ)
    d_ring.ellipse((2, 2, 253, 253), outline=colors[i], width=4)
    preview.paste(circ, (10 + i * 266, 276), circ)

preview_path = ROOT / 'artifacts/inspect/balanced_avatars_preview.png'
preview_path.parent.mkdir(parents=True, exist_ok=True)
preview.save(preview_path)
print(f'Preview saved to {preview_path}')
