"""Normalize generated enemy frames to 192px cells, feet at y=192.
Run with Pillow: python3 scripts/prepare_enemies.py.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/enemies'
source = Image.open(OUT / 'generated/enemy-sheet.png').convert('RGBA')
# The generated rows have unequal artwork heights; boundaries sit in empty gutters.
rows = [(0, 292), (292, 552), (552, 816), (816, 1005), (1005, 1275), (1275, 1536)]
keys = ['ninja', 'archer', 'gingerbread', 'slime', 'robot', 'alien']
for key, (top, bottom) in zip(keys, rows):
    frames = []
    for column in range(4):
        cell = source.crop(([0, 270, 526, 783][column], top, [270, 526, 783, 1024][column], bottom))
        mask = cell.getchannel('A').point(lambda alpha: 255 if alpha > 40 else 0)
        box = mask.getbbox()
        frames.append(cell.crop(box))
    # One scale for the entire row preserves the animation's relative proportions.
    scale = min(180 / max(f.width for f in frames), (115 if key == 'slime' else 180) / max(f.height for f in frames))
    sheet = Image.new('RGBA', (768, 192))
    for index, frame in enumerate(frames):
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        sheet.alpha_composite(frame, (index * 192 + (192 - frame.width) // 2, 192 - frame.height))
    sheet.save(OUT / f'{key}.png')
