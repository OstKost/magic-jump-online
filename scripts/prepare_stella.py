"""Slice user-supplied Stella v2 sheet; preserve 256px frames and (128,240) support."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
source=Image.open(ROOT/'concept/chars-2/Stella-sprite.png').convert('RGBA').resize((1536,1024))
def cut(box):
    a=np.array(source.crop(box)); rgb=a[:,:,:3].astype(int)
    a[(rgb.min(2)>150)&(rgb.max(2)-rgb.min(2)<15),3]=0
    im=Image.fromarray(a); return im.crop(im.getbbox())
frames={}
def add(name,box):
    im=cut(box); im=im.resize((round(im.width*.95),round(im.height*.95)),Image.Resampling.LANCZOS)
    f=Image.new('RGBA',(256,256));f.alpha_composite(im,((256-im.width)//2,240-im.height));frames[name]=f
clips={
'idle':[(350,40,459,175),(460,40,566,175),(569,40,672,175),(675,40,774,175)],
'run':[(798,44,891,174),(892,44,986,174),(987,44,1081,174),(1082,44,1178,174),(1179,44,1269,174),(1270,44,1358,174),(1359,44,1445,174),(1446,44,1536,174)],
'jump':[(45,225,146,350),(179,210,297,350),(305,210,433,350),(451,208,590,350)],
'flip':[(714,218,844,347),(866,216,1017,347),(1032,205,1177,347),(1187,218,1310,347),(1334,218,1503,347)],
'duck':[(49,391,201,482),(205,391,402,482),(407,391,616,482),(620,391,839,482),(840,391,1080,482),(1081,391,1316,482),(1317,391,1525,482)],
'cast-projectile':[(25,530,129,649),(145,530,246,649),(265,530,387,649),(397,530,538,649),(541,530,653,649)],
'cast-wave':[(798,530,909,649),(925,530,1090,649),(1092,530,1212,649)],
'cast-burst':[(22,700,119,828),(138,700,263,828),(270,700,416,828),(424,688,577,828)],
'hit':[(782,696,897,817),(898,696,1001,817),(1002,701,1113,817),(1114,728,1221,817),(1222,751,1317,817),(1318,751,1416,817),(1417,751,1524,817)]}
for action,boxes in clips.items():
    for i,b in enumerate(boxes):add(f'{action}-{i:02}',b)
folder=ROOT/'public/assets/characters/stella';atlas=Image.new('RGBA',(2112,264*((len(frames)+7)//8)));meta={}
for i,(name,f) in enumerate(frames.items()):
    x,y=i%8*264+4,i//8*264+4;atlas.alpha_composite(f,(x,y));meta[name]={'frame':{'x':x,'y':y,'w':256,'h':256},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':256,'h':256},'sourceSize':{'w':256,'h':256}}
atlas.save(folder/'atlas-v2.png');(folder/'atlas-v2.json').write_text(json.dumps({'frames':meta,'meta':{'image':'atlas-v2.png'}},indent=2))
cut((50,12,156,153)).resize((256,256),Image.Resampling.LANCZOS).save(folder/'avatar.png')
petboxes=[(218,891,298,984),(301,891,383,984),(389,891,467,984),(472,891,551,984),(584,898,680,983),(681,898,768,983),(769,898,860,983),(861,898,954,983),(955,898,1040,983),(1057,906,1144,997),(1145,894,1232,997),(1233,881,1318,997),(1319,877,1406,997),(1407,875,1495,997)]
pets=Image.new('RGBA',(128*len(petboxes),128))
for i,b in enumerate(petboxes):
    im=cut(b);im.thumbnail((108,108),Image.Resampling.LANCZOS);f=Image.new('RGBA',(128,128));f.alpha_composite(im,((128-im.width)//2,112-im.height));pets.alpha_composite(f,(128*i,0))
    if i==0:f.save(ROOT/'public/assets/pets/stella-cat-rest.png')
pets.save(ROOT/'public/assets/pets/stella-cat.png')
for key,b in {'projectile':(652,548,758,610),'wave':(1335,535,1523,643),'burst':(586,675,749,818)}.items():
    im=cut(b);im.thumbnail((116,88),Image.Resampling.LANCZOS);sheet=Image.new('RGBA',(512,96))
    for i in range(4):sheet.alpha_composite(im,(128*i+(128-im.width)//2,(96-im.height)//2))
    sheet.save(ROOT/f'public/assets/spells/stella-{key}.png')
print('Prepared',len(frames),'Stella frames')
