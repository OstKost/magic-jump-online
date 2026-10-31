"""Reproducible Sensei v2 atlas from user artwork; Pillow and NumPy required.
Idle phases animate the supplied pose with a subtle planted-foot breath.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'concept/chars-2/Sensei-sprite.png').convert('RGBA')
# Coordinates are authored against the supplied 1536 x 1024 reference.
source = source.resize((1536, 1024), Image.Resampling.LANCZOS)
folder = ROOT / 'public/assets/characters/sensei'
folder.mkdir(parents=True, exist_ok=True)
frames = {}
def cut(box):
    im = source.crop(box)
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    # Only neutral light checker pixels; preserve coloured ivory and magic.
    paper = (rgb.min(2) > 150) & (rgb.max(2)-rgb.min(2) < 15)
    a[paper, 3] = 0
    im = Image.fromarray(a)
    return im.crop(im.getbbox())
def add(name, box, scale=.76, phase=0):
    im = cut(box)
    im = im.resize((round(im.width*scale), round(im.height*scale*(1+phase))), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (256,256))
    frame.alpha_composite(im, ((256-im.width)//2,240-im.height))
    frames[name] = frame
for element,box in zip(['fire','water','air','earth'],[(12,37,141,223),(142,37,277,223),(279,37,409,223),(410,37,565,223)]):
    for i,phase in enumerate([0,.012,.022,.012]): add(f'idle-{element}-{i:02}',box,phase=phase)
for i,(l,r) in enumerate(zip([578,690,804,916,1025,1137,1263,1397],[690,804,916,1025,1137,1263,1397,1525])): add(f'run-{i:02}',(l,40,r,220))
for el,boxes in {'air':[(15,263,153,405),(154,260,260,402),(261,263,411,402)],'fire':[(413,263,590,405),(587,246,762,404),(413,263,590,405)]}.items():
    for i,b in enumerate(boxes): add(f'jump-{el}-{i:02}',b)
for el,boxes in {'air':[(772,266,908,405),(909,259,1024,400),(1025,265,1190,405)],'fire':[(1193,250,1355,405),(1356,251,1525,407),(1193,250,1355,405)]}.items():
    for i,b in enumerate(boxes): add(f'flip-{el}-{i:02}',b)
for el,boxes in {'water':[(14,443,219,534),(220,442,411,534),(412,440,599,534)],'earth':[(790,432,1007,534),(1009,434,1240,534),(1241,434,1522,534)]}.items():
    for i,b in enumerate(boxes): add(f'duck-{el}-{i:02}',b)
for el,boxes in {'fire':[(14,580,117,691),(119,580,226,691),(227,579,337,691)],'water':[(461,580,550,691),(553,580,655,691),(553,580,655,691)],'air':[(15,695,114,809),(116,695,224,809),(116,695,224,809)],'earth':[(451,694,552,810),(553,694,656,810),(553,694,656,810)],'harmony':[(895,621,1042,790),(1043,604,1189,790),(1188,600,1322,790)]}.items():
    for i,b in enumerate(boxes): add(f'cast-{el}-{i:02}',b)
for i,b in enumerate([(13,861,168,982),(169,864,274,982),(274,877,386,982),(386,895,478,982),(478,913,607,982)]): add(f'hit-{i:02}',b)
# Legacy aliases keep shared renderers compatible while v2 selects richer clips.
for action,el,count in [('idle','fire',1),('jump','air',3),('flip','air',4),('duck','water',3)]:
    for i in range(count): frames[f'{action}-{i:02}']=frames[f'{action}-{el}-{min(i,2):02}']
atlas=Image.new('RGBA',(264*8,264*((len(frames)+7)//8)))
meta={}
for i,(name,frame) in enumerate(frames.items()):
    x,y=i%8*264+4,i//8*264+4
    atlas.alpha_composite(frame,(x,y))
    meta[name]={'frame':{'x':x,'y':y,'w':256,'h':256},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':256,'h':256},'sourceSize':{'w':256,'h':256}}
atlas.save(folder/'atlas.png')
(folder/'atlas.json').write_text(json.dumps({'frames':meta,'meta':{'image':'atlas.png','size':{'w':atlas.width,'h':atlas.height},'scale':'1'}},indent=2))
cut((43,36,122,121)).resize((256,256),Image.Resampling.LANCZOS).save(folder/'avatar.png')
petfolder=ROOT/'public/assets/pets'
petframes=[]
for b in [(614,880,689,986),(690,887,744,986),(746,889,837,986),(835,895,898,986),(898,895,1010,986),(1008,880,1107,986),(1104,887,1216,986),(1220,858,1303,986),(1305,858,1377,986),(1378,858,1452,986),(1454,860,1525,986)]:
    im=cut(b); im.thumbnail((112,112),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(128,128));frame.alpha_composite(im,((128-im.width)//2,112-im.height));petframes.append(frame)
sheet=Image.new('RGBA',(128*len(petframes),128))
for i,f in enumerate(petframes):sheet.alpha_composite(f,(i*128,0))
sheet.save(petfolder/'sensei-dog.png');petframes[0].save(petfolder/'sensei-dog-rest.png')
for el,b in {'fire':(338,584,449,653),'water':(767,591,887,670),'air':(343,692,442,790),'earth':(786,697,894,794),'harmony':(1326,580,1525,790)}.items():
    im=cut(b); im.thumbnail((110,84),Image.Resampling.LANCZOS)
    sheet=Image.new('RGBA',(512,96))
    for i in range(4):
        phase=im.resize((round(im.width*(1-i*.025)),round(im.height*(1+i*.025))),Image.Resampling.LANCZOS)
        sheet.alpha_composite(phase,(i*128+(128-phase.width)//2,(96-phase.height)//2))
    sheet.save(ROOT/f'public/assets/spells/sensei-{el}.png')
Image.open(ROOT/'public/assets/spells/sensei-harmony.png').save(ROOT/'public/assets/spells/sensei.png')
print(f'Prepared {len(frames)} Sensei frames')
