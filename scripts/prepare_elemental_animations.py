"""Pack six edited action poses into existing clean atlases. Requires Pillow.
Sources: assets/characters/generated/*-actions-magic.png (image_gen edits).
Running, idle and hit frames are copied byte-for-byte from the clean PNGs.
"""
from pathlib import Path
import json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/characters'
ACTIONS=['jump-00','jump-01','jump-02','duck-00','duck-01','duck-02']
preview=Image.new('RGB',(6*256,2*280),'#526b78');draw=ImageDraw.Draw(preview)
for row,hero in enumerate(['sofia','stella']):
    folder=OUT/hero
    sheet=Image.open(OUT/'generated'/f'{hero}-actions-magic.png').convert('RGBA')
    if sheet.getextrema()[3][0]==255:raise ValueError(f'{hero}: no alpha')
    sheet=sheet.resize((1536,1024),Image.Resampling.LANCZOS)
    edited={}
    for idx,key in enumerate(ACTIONS):
        x=idx%3*512;y=idx//3*512
        frame=sheet.crop((x,y,x+512,y+512)).resize((256,256),Image.Resampling.LANCZOS)
        frame.save(folder/f'{key}-elemental.png');edited[key]=frame
        preview.paste(frame,(idx*256,row*280),frame);draw.text((idx*256+8,row*280+256),f'{hero}/{key}',fill='white')
    data=json.loads((folder/'atlas-clean.json').read_text())
    atlas=Image.new('RGBA',(2112,792))
    for key,entry in data['frames'].items():
        frame=edited[key] if key in edited else Image.open(folder/f'{key}-clean.png')
        f=entry['frame'];atlas.paste(frame,(f['x'],f['y']))
    data['meta']['image']='atlas-elemental.png'
    atlas.save(folder/'atlas-elemental.png')
    (folder/'atlas-elemental.json').write_text(json.dumps(data,indent=2))
preview.save(OUT/'action-preview-elemental.jpg')
print('Packed elemental actions; preserved all clean running, idle and hit frames.')
