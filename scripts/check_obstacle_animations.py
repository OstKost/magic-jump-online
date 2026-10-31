"""Validate packed alpha gutters, frame variation, anchors and offline assets."""
import json
from pathlib import Path
from PIL import Image
from animation_inventory import ROOT, items

text = (ROOT / 'src/obstacle-animation-data.ts').read_text()
registry = json.loads(text.split('export const animationData = ', 1)[1].removesuffix(' as const;\n'))
assert set(registry) == {item['key'] for item in items}, 'Incomplete animation registry'
sw = (ROOT / 'public/sw.js').read_text()
for item in items:
    key = item['key']
    entry = registry[key]
    image = Image.open(ROOT / 'public' / entry['path'].lstrip('/')).convert('RGBA')
    width, height = entry['width'], entry['height']
    count = 11 if item['kind'] == 'enemy' else 8
    assert image.size == (width*4, height*((count+3)//4)), (key, image.size)
    assert entry['path'] in sw, f'{key}: missing offline cache entry'
    signatures = set()
    for index in range(count):
        frame = image.crop((index%4*width, index//4*height, (index%4+1)*width, (index//4+1)*height))
        alpha = frame.getchannel('A')
        box = alpha.getbbox()
        assert box and box[0]>=4 and box[1]>=4 and box[2]<=width-4 and box[3]<=height-4, (key,index,box)
        if index < 8:
            signatures.add(frame.tobytes())
    assert len(signatures)>=4, f'{key}: fewer than four distinct authored poses'
    assert 0 < entry['originX'] < width and 0 < entry['originY'] < height
    if entry['sourceMode'] == 'generated':
        assert (ROOT / 'pics/obstacle-animations' / f'{key}.prompt.txt').exists()
print(f'{len(registry)} animations: frame counts, four distinct poses, alpha gutters, origins and offline cache passed')
