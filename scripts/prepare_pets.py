"""Slice the generated 4×2 pet sheet, preserving its alpha and a common scale."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public/assets/pets'
source = Image.open(root / 'source.png').convert('RGBA')
w, h = source.size
cells = []
for row in range(2):
    frames = []
    for col in range(4):
        cell = source.crop((col*w//4, row*h//2, (col+1)*w//4, (row+1)*h//2))
        # Ignore isolated, almost transparent edge pixels when finding the bounds.
        bounds = cell.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
        frames.append(cell.crop(bounds))
    cells.append(frames)
scale = min(112 / max(im.width for row in cells for im in row), 100 / max(im.height for row in cells for im in row))
for name, frames in zip(('black-cat', 'ginger-cat'), cells):
    sheet = Image.new('RGBA', (512, 128))
    for col, frame in enumerate(frames):
        frame = frame.resize((round(frame.width*scale), round(frame.height*scale)), Image.Resampling.LANCZOS)
        sheet.alpha_composite(frame, (col*128+(128-frame.width)//2, 112-frame.height))
    sheet.save(root / f'{name}.png')
