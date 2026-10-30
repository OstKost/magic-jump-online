"""Pack generated, transparent 4x4 animation sheets into padded Phaser atlases.
Requires Pillow and NumPy. Inputs are retained under assets/characters/generated.
Run after generation: python scripts/prepare_clean_animations.py
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/characters'
# Grid order is part of the generation prompt, not inferred from file names.
KEYS=[f'run-{i:02d}' for i in range(8)]+['jump-00','jump-01','jump-02','idle-00','duck-00','duck-01','duck-02','hit-01']
preview=Image.new('RGB',(8*256,6*280),'#526b78');draw=ImageDraw.Draw(preview)
manifest={'frameSize':256,'origin':{'x':.5,'y':240/256},'characters':{}}
for ci,hero in enumerate(['sofia','stella']):
    sheet=Image.open(OUT/'generated'/f'{hero}-clean-sheet.png').convert('RGBA')
    if sheet.getextrema()[3][0]==255:
        raise ValueError(f'{hero}: generated sheet has no real transparency')
    # Generated layouts can drift a few pixels from the requested regular grid.
    # Split only through empty gutters, never through boots or hair.
    alpha=np.asarray(sheet)[:,:,3]
    def separators(axis):
        counts=(alpha>8).sum(axis=axis);length=len(counts);edges=[0]
        for part in range(1,4):
            center=round(part*length/4);radius=round(length*.07)
            candidates=np.flatnonzero(counts[max(0,center-radius):center+radius]==0)+max(0,center-radius)
            if not len(candidates):raise ValueError(f'{hero}: no empty gutter near {center}')
            edges.append(int(candidates[np.argmin(abs(candidates-center))]))
        return edges+[length]
    xs=separators(0);ys=separators(1)
    cells=[]
    for idx in range(16):
        x0=xs[idx%4];y0=ys[idx//4]
        x1=xs[idx%4+1];y1=ys[idx//4+1]
        im=sheet.crop((x0,y0,x1,y1));bbox=im.getbbox()
        if not bbox:raise ValueError(f'{hero}: empty cell {idx}')
        cells.append(im.crop(bbox))
    # One scale for all poses, keeping crouches low; normalize to original body height.
    scale=140/cells[11].height
    folder=OUT/hero
    atlas=Image.new('RGBA',(8*264,3*264));frames={};frames_png={}
    for idx,(key,im) in enumerate(zip(KEYS,cells)):
        size=(round(im.width*scale),round(im.height*scale))
        if max(size)>232:raise ValueError(f'{hero}/{key}: unexpectedly large cell {size}')
        im=im.resize(size,Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(256,256));frame.alpha_composite(im,((256-im.width)//2,240-im.height))
        frames_png[key]=frame
    # The last pose is held during the second half of damage; first phase uses existing
    # takeoff pose, a brief recoil before the fallen pose.
    frames_png['hit-00']=frames_png['jump-00'].copy()
    for idx,(key,frame) in enumerate(frames_png.items()):
        frame.save(folder/f'{key}-clean.png')
        x=idx%8*264+4;y=idx//8*264+4;atlas.alpha_composite(frame,(x,y))
        frames[key]={'frame':{'x':x,'y':y,'w':256,'h':256},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':256,'h':256},'sourceSize':{'w':256,'h':256}}
        px=idx%8*256;py=(ci*3+idx//8)*280;preview.paste(frame,(px,py),frame);draw.text((px+8,py+256),f'{hero}/{key}',fill='white')
    atlas.save(folder/'atlas-clean.png');(folder/'atlas-clean.json').write_text(json.dumps({'frames':frames,'meta':{'image':'atlas-clean.png','size':{'w':2112,'h':792},'scale':'1'}},indent=2))
    manifest['characters'][hero]={'animations':{action:[key for key in frames if key.startswith(action+'-')] for action in ['run','jump','idle','duck','hit']},'source':f'generated/{hero}-clean-sheet.png','uniformScale':scale}
preview.save(OUT/'animation-preview-clean.jpg');(OUT/'animations-clean.json').write_text(json.dumps(manifest,indent=2))
print('Packed clean atlases with 8 running phases and 4px outer gutters.')

# Two full cycles for quick visual review outside the game.
cycle=[]
for i in range(8):
    canvas=Image.new('RGB',(512,256),'#526b78')
    for x,hero in [(0,'sofia'),(256,'stella')]:
        frame=Image.open(OUT/hero/f'run-{i:02d}-clean.png')
        canvas.paste(frame,(x,0),frame)
    cycle.append(canvas)
cycle[0].save(OUT/'run-cycle-clean.gif',save_all=True,append_images=cycle[1:],duration=83,loop=0,disposal=2)
