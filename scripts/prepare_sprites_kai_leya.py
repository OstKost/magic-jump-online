"""Slice secret heroes Kai (lightning) and Leya (nature) from concept/pics/sprite-3.png.
Creates character atlases, standalone animation frames, avatars and rear views.
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

def cut(rect, tolerance=35, isolate=False):
    crop = src.crop(rect)
    a = np.asarray(crop).copy()
    r, g, b = [a[:, :, i].astype(float) for i in range(3)]
    # Background paper color: light creamy parchment
    paper = (r > 175) & (g > 180) & (b > 165) & (np.abs(r - g) < tolerance) & (np.abs(g - b) < tolerance)
    seed = np.zeros(paper.shape, bool)
    seed[0, :] = paper[0, :]
    seed[-1, :] = paper[-1, :]
    seed[:, 0] = paper[:, 0]
    seed[:, -1] = paper[:, -1]
    bg = ndi.binary_propagation(seed, mask=paper)
    labels, n = ndi.label(~bg)
    sizes = np.bincount(labels.ravel())
    keep = sizes >= 35
    keep[0] = False
    if isolate:
        # Disconnected pieces at a crop boundary belong to adjacent poses or text.
        # Keep the body and nearby magic, using source pixels before resampling.
        body_label = 1 + np.argmax(sizes[1:])
        body = labels == body_label
        distance = ndi.distance_transform_edt(~body)
        for label in np.flatnonzero(keep):
            component = labels == label
            ys, xs = np.nonzero(component)
            touches_edge = (xs.min() == 0 or xs.max() == a.shape[1] - 1
                            or ys.min() == 0 or ys.max() == a.shape[0] - 1)
            if label != body_label and (touches_edge or distance[component].min() > 6):
                keep[label] = False
    alpha = (keep[labels] * 255).astype('uint8')
    im = Image.fromarray(np.dstack([a, alpha]))
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

# Calibrated rects for Kai
kai_splits = {
    'run': (68, 156, [325, 395, 469, 541, 613, 681, 755]),
    'jump': (182, 274, [325, 401, 486, 571, 664, 755]),
    'flip': (315, 409, [330, 403, 476, 550, 620, 685, 755]),
    'hit': (445, 516, [330, 400, 466, 533, 600, 681, 752]),
    'idle': (550, 644, [304, 354, 414, 478]),
    'duck': (550, 644, [490, 579, 674, 752]),
}

# Calibrated rects for Leya
leya_splits = {
    'run': (68, 156, [1100, 1181, 1242, 1310, 1385, 1446, 1520]),
    'jump': (182, 274, [1115, 1190, 1270, 1360, 1432, 1515]),
    'flip': (315, 409, [1120, 1195, 1267, 1335, 1400, 1458, 1520]),
    'hit': (445, 516, [1150, 1215, 1280, 1345, 1430, 1520]),
    'idle': (550, 644, [1075, 1125, 1180, 1235, 1295]),
    'duck': (550, 644, [1295, 1365, 1440, 1520]),
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
            overrides = {
                ('leya', 'jump', 2): (1270, 178, 1360, 274),
                ('kai', 'jump', 2): (486, 175, 571, 274),
                ('leya', 'run', 5): (1454, 68, 1520, 156),
                ('leya', 'flip', 0): (1120, 315, 1195, 409),
                ('leya', 'flip', 3): (1335, 310, 1400, 409),
                ('leya', 'hit', 0): (1154, 445, 1215, 516),
                ('leya', 'hit', 4): (1438, 445, 1520, 516),
            }
            rect = overrides.get((key, action, i), rect)
            im = cut(rect, isolate=True)
            # Keep one body scale across poses; never stretch individual frames.
            im = im.resize((round(im.width * 1.5), round(im.height * 1.5)), Image.Resampling.LANCZOS)
            
            # Place into 256x256 frame with origin (128, 240)
            frame = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
            frame.alpha_composite(im, ((256 - im.width) // 2, 240 - im.height))
            frame.save(folder / f'{frame_name}.png')
            cut_frames.append((frame_name, frame))
            
    # Pack into atlas
    cols = cfg['cols']
    rows = (len(cut_frames) + cols - 1) // cols
    atlas_w = cols * 264
    atlas_h = rows * 264
    atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
    frames_json = {}
    
    for idx, (frame_name, frame) in enumerate(cut_frames):
        gx = (idx % cols) * 264 + 4
        gy = (idx // cols) * 264 + 4
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


# Supplemental expression and rear views, outside the gameplay atlas.
for key, portraits, backs in [
    ('kai', [8, 92, 171, 251, 330, 405, 480], [492, 558, 625, 689, 751]),
    ('leya', [782, 861, 940, 1019, 1098, 1177, 1252], [1260, 1320, 1382, 1445, 1515]),
]:
    folder = ASSETS / 'characters' / key
    for prefix, splits, top, bottom in [('portrait', portraits, 672, 762), ('back', backs, 674, 762)]:
        for i, (left, right) in enumerate(zip(splits, splits[1:])):
            cut((left, top, right, bottom), isolate=True).save(folder / f'{prefix}-{i:02d}.png')

preview = Image.new('RGB', (7 * 180, 10 * 190), '#647080')
draw = ImageDraw.Draw(preview)
for hero_index, cfg in enumerate(CHARACTERS_CFG):
    folder = ASSETS / 'characters' / cfg['key']
    names = [f'{action}-{i:02d}' for action, (_, _, splits) in cfg['splits'].items() for i in range(len(splits)-1)]
    for i, name in enumerate(names):
        frame = Image.open(folder / f'{name}.png')
        frame.thumbnail((175, 160))
        x, y = (i % 7)*180, (hero_index*5+i//7)*190
        preview.paste(frame, (x,y), frame)
        draw.text((x+4,y+165), cfg['key']+' '+name, fill='white')
    frames = [Image.open(folder / f'run-{i:02d}.png') for i in range(6)]
    frames[0].save(folder / 'run-preview.gif', save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
preview.save(ASSETS / 'characters/kai-leya-preview.jpg')
