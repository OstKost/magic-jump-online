"""Slice secret heroes Kai (lightning) and Leya (nature) from concept/pics/sprite-3.png.
Creates atlases, standalone animation frames, avatars, and pet companions.
Requires Pillow, NumPy, SciPy.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
SRC_PATH = ROOT / 'concept/pics/sprite-3.png'

src = Image.open(SRC_PATH).convert('RGB')

def cut(rect, tolerance=35):
    crop = src.crop(rect)
    a = np.asarray(crop).copy()
    r, g, b = [a[:, :, i].astype(float) for i in range(3)]
    # Background paper color: light creamy parchment
    paper = (r > 190) & (g > 180) & (b > 165) & (np.abs(r - g) < tolerance) & (np.abs(g - b) < tolerance)
    seed = np.zeros(paper.shape, bool)
    seed[0, :] = paper[0, :]
    seed[-1, :] = paper[-1, :]
    seed[:, 0] = paper[:, 0]
    seed[:, -1] = paper[:, -1]
    bg = ndi.binary_propagation(seed, mask=paper)
    labels, n = ndi.label(~bg)
    sizes = np.bincount(labels.ravel())
    keep = sizes >= 20
    keep[0] = False
    alpha = (keep[labels] * 255).astype('uint8')
    im = Image.fromarray(np.dstack([a, alpha]))
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

# Calibrated rects for Kai
kai_splits = {
    'run': (68, 156, [325, 395, 469, 541, 613, 681, 755]),
    'jump': (180, 290, [325, 401, 486, 571, 664, 755]),
    'flip': (335, 415, [325, 397, 470, 545, 620, 685, 765]),
    'hit': (465, 535, [330, 405, 478, 550, 615, 760]),
    'idle': (568, 646, [345, 408, 470, 545]),
    'duck': (568, 646, [530, 610, 680, 755]),
}

# Calibrated rects for Leya
leya_splits = {
    'run': (68, 156, [1100, 1181, 1242, 1310, 1385, 1446, 1520]),
    'jump': (180, 290, [1115, 1190, 1270, 1360, 1432, 1515]),
    'flip': (335, 415, [1075, 1150, 1225, 1300, 1375, 1450, 1520]),
    'hit': (465, 535, [1120, 1195, 1270, 1350, 1430, 1520]),
    'idle': (568, 646, [1075, 1125, 1180, 1235, 1295]),
    'duck': (568, 646, [1295, 1365, 1440, 1520]),
}

CHARACTERS_CFG = [
    {
        'key': 'kai',
        'name': 'Кай',
        'splits': kai_splits,
        'avatar_box': (55, 140, 255, 340),
        'cols': 7,
    },
    {
        'key': 'leya',
        'name': 'Лея',
        'splits': leya_splits,
        'avatar_box': (840, 120, 1040, 320),
        'cols': 7,
    },
]

# 1. Slice and build character atlases
for cfg in CHARACTERS_CFG:
    key = cfg['key']
    folder = ASSETS / 'characters' / key
    folder.mkdir(parents=True, exist_ok=True)
    
    # Save avatar
    avatar = src.crop(cfg['avatar_box']).resize((256, 256), Image.Resampling.LANCZOS)
    avatar.save(folder / 'avatar.png', format='PNG', optimize=True)
    print(f'Saved avatar for {key}')
    
    # Slice frames
    cut_frames = []
    for action, (y0, y1, splits) in cfg['splits'].items():
        for i in range(len(splits) - 1):
            frame_name = f'{action}-{i:02d}'
            rect = (int(splits[i]), y0, int(splits[i+1]), y1)
            im = cut(rect)
            
            # Place into 256x256 frame with origin (128, 240)
            frame = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
            frame.alpha_composite(im, ((256 - im.width) // 2, 240 - im.height))
            frame.save(folder / f'{frame_name}.png')
            cut_frames.append((frame_name, frame))
            
    # Pack into atlas
    cols = cfg['cols']
    rows = (len(cut_frames) + cols - 1) // cols
    atlas_w = cols * 256
    atlas_h = rows * 256
    atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
    frames_json = {}
    
    for idx, (frame_name, frame) in enumerate(cut_frames):
        gx = (idx % cols) * 256
        gy = (idx // cols) * 256
        atlas.alpha_composite(frame, (gx, gy))
        frames_json[frame_name] = {
            'frame': {'x': gx, 'y': gy, 'w': 256, 'h': 256},
            'rotated': False,
            'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': 256, 'h': 256},
            'sourceSize': {'w': 256, 'h': 256},
        }
        
    atlas.save(folder / 'atlas.png', optimize=True)
    atlas_meta = {
        'frames': frames_json,
        'meta': {
            'image': 'atlas.png',
            'size': {'w': atlas_w, 'h': atlas_h},
            'scale': '1',
        },
    }
    (folder / 'atlas.json').write_text(json.dumps(atlas_meta, indent=2))
    print(f'Saved {key} atlas ({len(cut_frames)} frames) to {folder / "atlas.png"}')

# 2. Slice pets
pets_dir = ASSETS / 'pets'
pets_dir.mkdir(parents=True, exist_ok=True)

# Falcon
falcon_stand = cut((230, 880, 310, 960))
falcon_fly = cut((303, 785, 385, 885))

# Fit into 128x128 with bottom at y=112 (stand) and y=104 (fly)
def make_pet_frame(im, ground_y=112):
    f = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    max_w, max_h = 96, 80
    if im.width > max_w or im.height > max_h:
        ratio = min(max_w / im.width, max_h / im.height)
        im = im.resize((int(im.width * ratio), int(im.height * ratio)), Image.Resampling.LANCZOS)
    f.alpha_composite(im, ((128 - im.width) // 2, ground_y - im.height))
    return f

f_stand = make_pet_frame(falcon_stand, 112)
f_fly = make_pet_frame(falcon_fly, 104)

f_stand.save(pets_dir / 'falcon.png')
f_stand.save(pets_dir / 'falcon-rest.png')
f_fly.save(pets_dir / 'falcon-fly.png')
print('Saved falcon pet frames')

# Red Panda
panda_sit = cut((940, 875, 1030, 955))
panda_walk = cut((970, 798, 1036, 870))

p_sit = make_pet_frame(panda_sit, 112)
p_walk = make_pet_frame(panda_walk, 112)

p_sit.save(pets_dir / 'red-panda.png')
p_sit.save(pets_dir / 'red-panda-rest.png')
p_walk.save(pets_dir / 'red-panda-run.png')
print('Saved red panda pet frames')
