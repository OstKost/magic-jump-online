"""Rebuild combat atlases from retained ImageGen sources (requires Pillow)."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]/'public/assets'
keys=['ninja','archer','gingerbread','slime','robot','alien','kikimora','vodyanoy','sandworm','desert-guard']
source=Image.open(ROOT/'enemies/generated/enemy-sheet-v2.png').convert('RGBA')
rows=[0,165,314,466,595,748,902,1055,1208,1345,1496]
for row,key in enumerate(keys):
    cells=[]
    for col in range(7):
        cell=source.crop((round(col*source.width/7),rows[row],round((col+1)*source.width/7),rows[row+1]))
        box=cell.getchannel('A').point(lambda a:255 if a>60 else 0).getbbox()
        cells.append(cell.crop(box) if box else cell)
    scale=min(180/max(c.width for c in cells), (115 if key=='slime' else 175)/max(c.height for c in cells))
    sheet=Image.new('RGBA',(192*7,192))
    for col,cell in enumerate(cells):
        cell=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
        sheet.alpha_composite(cell,(col*192+(192-cell.width)//2,192-cell.height))
    sheet.save(ROOT/f'enemies/{key}-v2.png')
spell_path=ROOT/'spells/generated/spell-sheet-transparent.png'
if spell_path.exists():
    source=Image.open(spell_path).convert('RGBA')
    for col,key in enumerate(['sofia','stella','air','earth','kai','leya']):
        sheet=Image.new('RGBA',(128*4,96))
        for row in range(4):
            cell=source.crop((round(col*source.width/6),round(row*source.height/4),round((col+1)*source.width/6),round((row+1)*source.height/4)))
            cell.thumbnail((124,92),Image.Resampling.LANCZOS)
            sheet.alpha_composite(cell,(row*128+(128-cell.width)//2,(96-cell.height)//2))
        sheet.save(ROOT/f'spells/{key}.png')
