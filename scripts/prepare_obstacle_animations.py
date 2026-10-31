"""Pack retained ImageGen sheets into isolated, registered game frames.

Run with a Python environment containing Pillow. Never generates images or calls
an API. Uses one scale per entire animation and registers static ground anchors;
no independent per-frame resizing. Source images and prompt files stay intact.
"""
from pathlib import Path
import argparse
import json
from PIL import Image
from animation_inventory import ROOT, items

OUT = ROOT / 'public/assets/animated'
GUTTER = 8
SOURCES = ROOT / 'pics/obstacle-animations'


def solid_box(image):
    return image.getchannel('A').point(lambda value: 255 if value > 48 else 0).getbbox()


def pack(item):
    sheet_key = item.get('sheetKey', item['key'])
    source = Image.open(SOURCES / f'{sheet_key}.png').convert('RGBA')
    layout_path = SOURCES / f'{sheet_key}.layout.json'
    layout = json.loads(layout_path.read_text()) if layout_path.exists() else {'columns': 4, 'rows': 2}
    columns, rows = layout['columns'], layout['rows']
    if columns * rows < 4:
        raise ValueError(f'{sheet_key}: need at least four source poses')
    cells = []
    anchors = []
    for index in range(4):
        col, row = index % columns, index // columns
        cell = source.crop((round(col*source.width/columns), round(row*source.height/rows), round((col+1)*source.width/columns), round((row+1)*source.height/rows)))
        box = solid_box(cell)
        if not box:
            raise ValueError(f'{item["key"]}: empty cell {index}')
        # Register the static lower support, not the moving canopy or weapon.
        lower = cell.crop((0, max(box[1], box[3]-round((box[3]-box[1])*.18)), cell.width, box[3]))
        feet = solid_box(lower)
        anchor = ((feet[0]+feet[2])/2, box[3])
        cells.append(cell)
        anchors.append(anchor)
    reference = Image.open(ROOT / item['source']).convert('RGBA')
    kind = item['kind']
    if kind == 'enemy':
        width, height, origin_x, origin_y, scale = 192, 192, 96, 192, .46
        reference = reference.crop((0, 0, 192, 192))
    elif kind == 'overhead':
        width, height, origin_x, origin_y, scale = 200, 160, 100, 155, 1
    else:
        width, height, origin_x, origin_y, scale = 256, 192, 128, 176, .46
    bounds = solid_box(reference)
    target_width = bounds[2]-bounds[0]
    target_height = bounds[3]-bounds[1]
    if kind == 'enemy':
        # Allow a raised weapon to extend without shrinking the whole body.
        target_width = 180
    if kind == 'ground' and item['key'] in ('rock', 'stakes', 'log', 'ground-4-0', 'ground-4-2'):
        target_height = min(156, target_height+28)
    if kind == 'overhead':
        target_width, target_height = 180, 145
    support = reference.crop((0, max(bounds[1], bounds[3]-round((bounds[3]-bounds[1])*.18)), reference.width, bounds[3]))
    support_box = solid_box(support)
    target_x = layout.get('referenceAnchorX', (support_box[0]+support_box[2])/2)+GUTTER
    target_y = bounds[3]+GUTTER
    left = max(anchor[0]-solid_box(cell)[0] for cell, anchor in zip(cells, anchors))
    right = max(solid_box(cell)[2]-anchor[0] for cell, anchor in zip(cells, anchors))
    extent_y = max(anchor[1]-solid_box(cell)[1] for cell, anchor in zip(cells, anchors))
    factor = min(target_width/(left+right), target_height/extent_y, (target_x-4)/max(1,left), (width+GUTTER*2-4-target_x)/max(1,right))
    fw, fh = width+GUTTER*2, height+GUTTER*2
    ox, oy = origin_x+GUTTER, origin_y+GUTTER
    frames = []
    for cell, anchor in zip(cells, anchors):
        frame = Image.new('RGBA', (fw, fh))
        resized = cell.resize((round(cell.width*factor), round(cell.height*factor)), Image.Resampling.LANCZOS)
        frame.alpha_composite(resized, (round(target_x-anchor[0]*factor), round(target_y-anchor[1]*factor)))
        frames.append(frame)
    # Four authored poses, played forward/backward: small motion without
    # generated second-row facing reversals or a jump at the loop boundary.
    frames = [frames[i] for i in (0, 1, 2, 3, 3, 2, 1, 0)]
    if kind == 'enemy':
        old = Image.open(ROOT / item['source']).convert('RGBA')
        for index in (4, 5, 6):
            frame = Image.new('RGBA', (fw, fh))
            frame.alpha_composite(old.crop((index*192, 0, (index+1)*192, 192)), (GUTTER, GUTTER))
            frames.append(frame)
    return save_atlas(item, frames, width, height, origin_x, origin_y, scale, 'generated')

def save_atlas(item, frames, width, height, origin_x, origin_y, scale, source_mode):
    fw, fh = width+GUTTER*2, height+GUTTER*2
    ox, oy = origin_x+GUTTER, origin_y+GUTTER
    atlas = Image.new('RGBA', (fw*4, fh*((len(frames)+3)//4)))
    for index, frame in enumerate(frames):
        box = solid_box(frame)
        if box[0] < 4 or box[1] < 4 or box[2] > fw-4 or box[3] > fh-4:
            raise ValueError(f'{item["key"]}: packed cell {index} lacks clear gutter: {box}')
        # Remove only low-alpha resampling fringe outside the checked gutter.
        isolated = Image.new('RGBA', (fw, fh))
        isolated.alpha_composite(frame.crop((4, 4, fw-4, fh-4)), (4, 4))
        atlas.alpha_composite(isolated, (index%4*fw, index//4*fh))
    atlas.save(OUT / f'{item["key"]}.png')
    return dict(path=f'/assets/animated/{item["key"]}.png', width=fw, height=fh, originX=ox, originY=oy, scale=scale, fps=6 if item['kind'] == 'enemy' else 8, count=8, defeatStart=8 if item['kind'] == 'enemy' else None, sourceMode=source_mode)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--partial', action='store_true', help='Pack available sources during generation')
    args = parser.parse_args()
    registry = {}
    for item in items:
        if not (SOURCES / f'{item["key"]}.png').exists() and args.partial:
            continue
        registry[item['key']] = pack(item)
    manifest = '/* Generated by scripts/prepare_obstacle_animations.py. */\nexport const animationData = ' + json.dumps(registry, indent=2) + ' as const;\n'
    (ROOT / 'src/obstacle-animation-data.ts').write_text(manifest)
    print(f'Packed {len(registry)}/{len(items)} animation sheets')


if __name__ == '__main__':
    main()
