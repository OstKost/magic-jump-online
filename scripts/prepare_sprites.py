"""Exact crops from pics/sprite.png. Requires pillow, numpy, scipy.
Run: python scripts/prepare_sprites.py. Never resizes/redraws the source artwork.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets'
src = Image.open(ROOT / 'pics/sprite.png').convert('RGB')
# Rectangles exclude headings and horizontal guide rules.
water = {'run':[(336,65,464,212),(464,65,577,212),(577,65,688,212),(688,65,807,212),(807,65,933,212)],'jump':[(965,83,1117,213),(1118,34,1245,177),(1247,95,1374,213)],'hit':[(1393,66,1563,213),(1563,96,1754,213)],'idle':[(379,280,474,419)],'duck':[(588,296,724,411),(724,308,883,411),(883,310,1047,411)]}
fire = {'run':[(337,493,474,652),(474,493,592,652),(592,493,710,652),(710,493,829,652),(829,493,938,652)],'jump':[(966,528,1118,654),(1120,473,1241,623),(1245,536,1373,654)],'hit':[(1391,505,1563,654),(1563,544,1755,654)],'idle':[(379,711,474,864)],'duck':[(588,736,716,856),(716,741,879,856),(879,741,1051,856)]}
def cut(rect):
    a=np.asarray(src.crop(rect)).copy(); r,g,b=[a[:,:,i].astype(float) for i in range(3)]
    paper=(r>167)&(g>154)&(b>133)&((r-b)<62)&((r-g)<36)
    seed=np.zeros(paper.shape,bool);seed[0,:]=paper[0,:];seed[-1,:]=paper[-1,:];seed[:,0]=paper[:,0];seed[:,-1]=paper[:,-1]
    bg=ndi.binary_propagation(seed,mask=paper)
    labels,n=ndi.label(~bg);sizes=np.bincount(labels.ravel());keep=(sizes>=22);keep[0]=False
    alpha=(keep[labels]*255).astype('uint8')
    result=Image.fromarray(np.dstack([a,alpha]),'RGBA')
    return result.crop(result.getbbox())
manifest={'source':'pics/sprite.png','frameSize':256,'origin':{'x':.5,'y':240/256},'characters':{},'obstacles':{}}
preview=Image.new('RGB',(7*256,5*280),'#77908c');d=ImageDraw.Draw(preview)
for ci,(name,poses) in enumerate([('sofia',water),('stella',fire)]):
    folder=OUT/'characters'/name;folder.mkdir(parents=True,exist_ok=True)
    atlas=Image.new('RGBA',(7*256,2*256)); frames={};animations={};idx=0
    for action,rects in poses.items():
        animations[action]=[]
        for i,rect in enumerate(rects):
            key=f'{action}-{i:02d}';im=cut(rect);frame=Image.new('RGBA',(256,256));frame.alpha_composite(im,((256-im.width)//2,240-im.height))
            frame.save(folder/f'{key}.png');x=(idx%7)*256;y=(idx//7)*256;atlas.alpha_composite(frame,(x,y))
            frames[key]={'frame':{'x':x,'y':y,'w':256,'h':256},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':256,'h':256},'sourceSize':{'w':256,'h':256}}
            animations[action].append(key);px=x;py=(ci*2+idx//7)*280;preview.paste(frame,(px,py),frame);d.text((px+8,py+254),f'{name}/{key}',fill='white');idx+=1
    atlas.save(folder/'atlas.png');(folder/'atlas.json').write_text(json.dumps({'frames':frames,'meta':{'image':'atlas.png','size':{'w':1792,'h':512},'scale':'1'}},indent=2))
    manifest['characters'][name]={'animations':animations,'frameRate':{'run':10,'jump':6,'hit':5,'idle':1,'duck':8},'sourceRects':poses}
for idx,(name,rect) in enumerate({'rock':(1090,315,1234,408),'stakes':(1235,311,1356,408),'log':(1356,337,1534,408),'lantern':(1540,291,1658,408),'banner':(1658,255,1758,408)}.items()):
    im=cut(rect);frame=Image.new('RGBA',(256,192));frame.alpha_composite(im,((256-im.width)//2,176-im.height));frame.save(OUT/'obstacles'/f'{name}.png');preview.paste(frame,(idx*256,1120),frame);d.text((idx*256+8,1320),name,fill='white');manifest['obstacles'][name]={'sourceRect':rect,'origin':{'x':.5,'y':176/192}}
(OUT/'sprites.json').write_text(json.dumps(manifest,indent=2));preview.save(OUT/'sprite-preview.jpg')
