"""Source identities and motion briefs for obstacle animation generation."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
items = []
def add(key, source, kind, motion):
    items.append(dict(key=key, source='public/assets/' + source, kind=kind, motion=motion))
for key, motion in [('rock', 'small red pennant on fixed pole; cloth flutters'), ('stakes', 'small cloth pennant tied to one stake flutters'), ('log', 'small Chinese lantern hanging close to log sways and softly pulses')]:
    add(key, f'obstacles/{key}.png', 'ground', motion)
for world, motions in [(3, ['moss and little leaves on stump flutter', 'leaves and moss on roots sway', 'mushroom caps gently bob']), (4, ['small pennant attached to rock flutters', 'blue crystal inner glow softly pulses', 'small ribbon tied to column flutters'])]:
    for variant, motion in enumerate(motions):
        add(f'ground-{world}-{variant}', f'obstacles/world-{world}-{variant}.png', 'ground', motion)
motions = [
    ['sakura branch sways slightly; hanging lantern gently swings and pulses', 'pine branch sways; crane tilts head slightly', 'tethered dragon kite and tail float in wind; anchor fixed', 'small pennants attached to gate flutter; gate rigid'],
    ['candy tree branch gently sways and hanging sweet swings', 'gingerbread branch sways; marshmallow bee softly moves wings', 'tethered candy kite and tail float; anchor fixed', 'small ribbons tied to candy gate flutter; gate rigid'],
    ['scanner light moves softly across fixed crystal pylon', 'drone gently moves wings on fixed antenna beam', 'tethered orbital probe floats gently; anchor fixed', 'plasma in portal softly pulses; pillars fixed'],
    ['moss hanging from wooden beam sways; beam and posts rigid', 'hanging moss on root arch sways; roots fixed'],
    ['red pennants attached to stone arch flutter; stones fixed', 'red cloth canopy ripples; posts fixed'],
]
for world, entries in enumerate(motions):
    for variant, motion in enumerate(entries):
        add(f'overhead-{world}-{variant}', f'obstacles/overhead/level-{world}-variant-{variant}.png', 'overhead', motion)
for key, motion in [('ninja', 'raises sword slightly into ready pose'), ('archer', 'raises bow and draws string slightly'), ('gingerbread', 'raises weapon slightly into ready pose'), ('slime', 'softly squashes and stretches in place'), ('robot', 'raises arm into ready pose'), ('alien', 'moves arms into ready pose'), ('kikimora', 'reaches hands slightly forward'), ('vodyanoy', 'raises spear slightly'), ('sandworm', 'sways slightly and opens mouth'), ('desert-guard', 'raises staff into ready pose')]:
    add(f'enemy-{key}', f'enemies/{key}-v2.png', 'enemy', motion)
if __name__ == '__main__':
    destination = ROOT / 'pics/obstacle-animations/inventory.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(items, indent=2) + '\n')
    print(len(items), 'unique animation sources')
