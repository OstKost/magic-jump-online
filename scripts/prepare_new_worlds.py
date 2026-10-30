"""Assemble the generated world sheets. Requires Pillow and rembg[cpu]."""
from pathlib import Path
from PIL import Image
from rembg import remove, new_session
ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'pics/new-worlds'
im = Image.open(source / 'panoramas.png')
for row in range(2):
    im.crop((0, row*im.height//2, im.width, (row+1)*im.height//2)).resize((2048,683)).save(ROOT / f'public/art/level-{row+4}-bg.png')
sheet = Image.open(source / 'sprites.png').convert('RGBA')
session = new_session('u2netp')
def sprite(row, col):
    cell = sheet.crop((col*sheet.width//4,row*sheet.height//4,(col+1)*sheet.width//4,(row+1)*sheet.height//4))
    cell = remove(cell, session=session)
    box = cell.getbbox()
    return cell.crop(box) if box else cell

def fit(im, size, bounds, foot):
    im = im.copy(); im.thumbnail(bounds, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', size)
    canvas.alpha_composite(im, ((size[0]-im.width)//2,foot-im.height))
    return canvas

out = ROOT / 'public/assets'
(out / 'bonuses').mkdir(exist_ok=True)
for world in (3,4):
    for variant in range(3):
        fit(sprite(world-3,variant),(256,192),(190,110),176).save(out / f'obstacles/world-{world}-{variant}.png')
    fit(sprite(world-3,3),(64,64),(52,52),58).save(out / f'bonuses/world-{world}.png')
    for variant in range(4):
        image = sprite(3,(world-3)*2+variant%2)
        # Independently align the beam and supports: bottom at 155, beam above duck clearance.
        fit(image,(200,160),(180,150),155).save(out / f'obstacles/overhead/level-{world}-variant-{variant}.png')
for col,key in enumerate(['kikimora','vodyanoy','sandworm','desert-guard']):
    base = sprite(2,col)
    atlas = Image.new('RGBA',(768,192))
    for frame,height in enumerate([176,172,168,172]):
        cell=fit(base,(192,192),(176,height),192)
        atlas.alpha_composite(cell,(frame*192,0))
    atlas.save(out / f'enemies/{key}.png')
