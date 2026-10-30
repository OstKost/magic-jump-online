"""Slice players 3/4 from pics/ sprite-2.png; requires Pillow, NumPy, SciPy."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'
src=Image.open(ROOT/'pics/ sprite-2.png').convert('RGB')
air={'run':[(346,45,429,152),(429,45,510,152),(510,45,591,152),(591,45,675,152),(675,45,773,152),(773,45,869,152)],'jump':[(354,213,452,306),(452,201,543,306),(543,174,650,288),(650,200,763,306),(763,226,872,306)],'idle':[(385,350,438,460),(445,350,511,460),(521,350,581,460)],'duck':[(602,374,690,458),(690,365,866,458)],'hit':[(387,509,489,589),(489,499,642,583),(642,484,866,583)]}
earth={'run':[(1231,45,1309,150),(1309,45,1398,150),(1398,45,1485,150),(1485,45,1577,150),(1577,45,1669,150),(1669,45,1760,150)],'jump':[(1247,218,1336,305),(1336,188,1445,305),(1445,170,1555,305),(1555,188,1662,305),(1662,218,1757,305)],'idle':[(1268,351,1328,459),(1334,351,1391,459),(1404,351,1462,459)],'duck':[(1484,372,1573,458),(1573,372,1759,458)],'hit':[(1263,508,1391,592),(1391,508,1536,592),(1536,490,1760,592)]}
def cut(rect):
    a=np.asarray(src.crop(rect)).copy();r,g,b=[a[:,:,i].astype(float) for i in range(3)]
    paper=(r>167)&(g>154)&(b>133)&((r-b)<62)&((r-g)<36)
    seed=np.zeros(paper.shape,bool);seed[0,:]=paper[0,:];seed[-1,:]=paper[-1,:];seed[:,0]=paper[:,0];seed[:,-1]=paper[:,-1]
    bg=ndi.binary_propagation(seed,mask=paper);labels,n=ndi.label(~bg);sizes=np.bincount(labels.ravel());keep=sizes>=22;keep[0]=False
    im=Image.fromarray(np.dstack([a,(keep[labels]*255).astype('uint8')]))
    return im.crop(im.getbbox())
manifest={'source':'pics/ sprite-2.png','frameSize':256,'origin':{'x':.5,'y':240/256},'characters':{},'extras':{}}
preview=Image.new('RGB',(1792,1680),'#77908c');draw=ImageDraw.Draw(preview)
for ci,(name,poses) in enumerate([('air',air),('earth',earth)]):
    folder=OUT/'characters'/name;folder.mkdir(parents=True,exist_ok=True)
    atlas=Image.new('RGBA',(1792,768));frames={};animations={};idx=0
    for action,rects in poses.items():
        animations[action]=[]
        for i,rect in enumerate(rects):
            key=f'{action}-{i:02d}';im=cut(rect);frame=Image.new('RGBA',(256,256));frame.alpha_composite(im,((256-im.width)//2,240-im.height));frame.save(folder/f'{key}.png')
            x=idx%7*256;y=idx//7*256;atlas.alpha_composite(frame,(x,y));frames[key]={'frame':{'x':x,'y':y,'w':256,'h':256},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':256,'h':256},'sourceSize':{'w':256,'h':256}}
            py=(ci*3+idx//7)*280;preview.paste(frame,(x,py),frame);draw.text((x+8,py+254),f'{name}/{key}',fill='white');animations[action].append(key);idx+=1
    atlas.save(folder/'atlas.png');(folder/'atlas.json').write_text(json.dumps({'frames':frames,'meta':{'image':'atlas.png','size':{'w':1792,'h':768},'scale':'1'}},indent=2))
    manifest['characters'][name]={'player':ci+3,'animations':animations,'frameRate':{'run':10,'jump':6,'idle':3,'duck':8,'hit':5},'sourceRects':poses}
    # Optional UI busts and rear views are separate from animation atlases.
    extras={'portrait':([(301,627,369,724),(369,627,438,724),(438,627,505,724),(505,627,574,724)] if name=='air' else [(1038,633,1107,730),(1107,633,1179,730),(1179,633,1250,730),(1250,633,1323,730),(1323,633,1403,730)]),'back':([(591,628,663,724),(663,628,734,724),(734,628,802,724),(802,628,868,724)] if name=='air' else [(1436,636,1516,731),(1516,636,1597,731),(1597,636,1670,731),(1670,636,1744,731)])}
    for kind,rects in extras.items():
        for i,rect in enumerate(rects):
            path=folder/f'{kind}-{i:02d}.png';cut(rect).save(path);manifest['extras'][str(path.relative_to(OUT))]={'sourceRect':rect,'trimmed':True}
# Context objects are isolated where the source allows it; vegetation retained.
for element,objects in {'air':{'lantern':(492,769,605,859),'stakes':(645,774,729,859),'rocks':(730,790,811,859),'banner':(810,738,879,859)},'earth':{'rock-log':(1385,774,1552,861),'stakes':(1552,776,1625,861),'lantern':(1625,774,1694,861),'banner':(1694,740,1766,861)}}.items():
    folder=OUT/'obstacles'/element;folder.mkdir(parents=True,exist_ok=True)
    for name,rect in objects.items():
        im=cut(rect);frame=Image.new('RGBA',(256,192));frame.alpha_composite(im,((256-im.width)//2,176-im.height));frame.save(folder/f'{name}.png');manifest['extras'][str((folder/f'{name}.png').relative_to(OUT))]={'sourceRect':rect,'origin':{'x':.5,'y':176/192}}
(OUT/'sprites-3-4.json').write_text(json.dumps(manifest,indent=2));preview.save(OUT/'sprite-preview-3-4.jpg')
print('Prepared 38 animation frames, 17 optional character images, 8 obstacles.')
paths=sorted([*OUT.joinpath('characters/air').glob('portrait*'),*OUT.joinpath('characters/air').glob('back*'),*OUT.joinpath('characters/earth').glob('portrait*'),*OUT.joinpath('characters/earth').glob('back*'),*OUT.joinpath('obstacles/air').glob('*.png'),*OUT.joinpath('obstacles/earth').glob('*.png')])
extras_preview=Image.new('RGB',(1280,1000),'#77908c');draw=ImageDraw.Draw(extras_preview)
for i,p in enumerate(paths):
    im=Image.open(p);x=i%5*256;y=i//5*166;im.thumbnail((240,135));extras_preview.paste(im,(x,y),im);draw.text((x,y+138),f'{p.parent.name}/{p.stem}',fill='white')
extras_preview.save(OUT/'sprite-extras-3-4.jpg')
