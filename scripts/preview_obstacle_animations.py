"""Render contact sheets and looping WebP previews from packed game frames."""
import json
from PIL import Image, ImageDraw
from animation_inventory import ROOT, items
OUT = ROOT / 'artifacts/qa/obstacle-animations'
OUT.mkdir(parents=True, exist_ok=True)
text = (ROOT / 'src/obstacle-animation-data.ts').read_text()
registry = json.loads(text.split('export const animationData = ', 1)[1].removesuffix(' as const;\n'))
for kind in ['ground', 'overhead', 'enemy']:
    group = [item for item in items if item['kind'] == kind and item['key'] in registry]
    overview = Image.new('RGB', (1000, len(group)*200), '#26313e')
    draw = ImageDraw.Draw(overview)
    for row, item in enumerate(group):
        entry = registry[item['key']]
        atlas = Image.open(ROOT / 'public' / entry['path'].lstrip('/')).convert('RGBA')
        frames = []
        for index in range(8):
            w, h = entry['width'], entry['height']
            frame = atlas.crop((index%4*w, index//4*h, (index%4+1)*w, (index//4+1)*h))
            backdrop = Image.new('RGBA', (w,h), '#26313e')
            backdrop.alpha_composite(frame)
            frames.append(backdrop.convert('RGB'))
            if index < 4:
                backdrop.thumbnail((220,170))
                overview.paste(backdrop.convert('RGB'), (100+index*225, row*200+25))
        draw.text((8,row*200+8), item['key'], fill='white')
        frames[0].save(OUT / f'{item["key"]}.webp', save_all=True, append_images=frames[1:], duration=round(1000/entry['fps']), loop=0)
    overview.save(OUT / f'{kind}-contact-sheet.png')
print('Contact sheets and animated WebP previews saved to', OUT)
