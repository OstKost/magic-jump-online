"""Generate double-jump somersault (flip) animation frames for all 4 characters
and pack them into their respective Phaser sprite atlases.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CHARS_DIR = ROOT / 'public/assets/characters'

CONFIG = {
    'sofia': {
        'source': CHARS_DIR / 'sofia/jump-01-elemental.png',
        'atlases': ['atlas-elemental', 'atlas-clean', 'atlas'],
        'color': (113, 204, 232),
        'accent': (220, 248, 255),
        'element': 'water',
        'is_sofia_stella': True,
    },
    'stella': {
        'source': CHARS_DIR / 'stella/jump-01-elemental.png',
        'atlases': ['atlas-elemental', 'atlas-clean', 'atlas'],
        'color': (239, 170, 118),
        'accent': (255, 230, 130),
        'element': 'fire',
        'is_sofia_stella': True,
    },
    'air': {
        'source': CHARS_DIR / 'air/jump-02.png',
        'atlases': ['atlas'],
        'color': (162, 224, 218),
        'accent': (230, 255, 250),
        'element': 'air',
        'is_sofia_stella': False,
    },
    'earth': {
        'source': CHARS_DIR / 'earth/jump-02.png',
        'atlases': ['atlas'],
        'color': (169, 199, 140),
        'accent': (245, 230, 160),
        'element': 'earth',
        'is_sofia_stella': False,
    },
}

FLIP_ANGLES = [-55, -155, -245, -325]

def create_flip_frames(hero_key: str, cfg: dict):
    src_im = Image.open(cfg['source']).convert('RGBA')
    bbox = src_im.getbbox()
    if not bbox:
        raise ValueError(f"Empty source for {hero_key}")
    
    # Calculate center of mass for rotation
    alpha = np.asarray(src_im)[:, :, 3]
    ys, xs = np.nonzero(alpha > 20)
    cx = float(np.mean(xs))
    cy = float(np.mean(ys))
    
    frames = []
    for idx, angle in enumerate(FLIP_ANGLES):
        frame = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        
        # Center the character around (128, 136) before rotation
        shift_x = 128 - cx
        shift_y = 136 - cy
        
        translated = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        translated.paste(src_im, (round(shift_x), round(shift_y)), src_im)
        
        # Rotate around (128, 136)
        # In Pillow, rotate rotates around the center of the image (128, 128)
        # Adjust so pivot is precisely (128, 136)
        dy = 128 - 136
        offset_im = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        offset_im.paste(translated, (0, dy), translated)
        
        rotated = offset_im.rotate(angle, resample=Image.Resampling.BICUBIC)
        
        # Shift back
        final_char = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        final_char.paste(rotated, (0, -dy), rotated)
        
        # Add elemental energy swirl around the somersault
        fx = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        draw = ImageDraw.Draw(fx)
        
        r_base = 56
        col_main = cfg['color']
        col_acc = cfg['accent']
        
        # Elemental spiral trail
        rad_step = angle * math.pi / 180.0
        for i in range(16):
            t = i / 16.0
            a = rad_step + t * math.pi * 1.5
            r = r_base + math.sin(t * math.pi) * 14
            px = 128 + math.cos(a) * r
            py = 136 + math.sin(a) * (r * 0.85)
            alpha_val = int(210 * (1.0 - t * 0.75))
            size = max(1, round(4.5 * (1.0 - t * 0.5)))
            
            fill = (col_main[0], col_main[1], col_main[2], alpha_val)
            draw.ellipse([px - size, py - size, px + size, py + size], fill=fill)
            if i % 3 == 0:
                acc_fill = (col_acc[0], col_acc[1], col_acc[2], alpha_val)
                draw.ellipse([px - size * 0.5, py - size * 0.5, px + size * 0.5, py + size * 0.5], fill=acc_fill)
        
        # Combine elemental flair behind/around character
        frame.alpha_composite(fx)
        frame.alpha_composite(final_char)
        
        # Foreground particle accents
        fg = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        fg_draw = ImageDraw.Draw(fg)
        for i in range(5):
            t = (idx * 0.25 + i * 0.2) % 1.0
            a = rad_step + math.pi + t * 2.0
            r = r_base + 8 + i * 4
            px = 128 + math.cos(a) * r
            py = 136 + math.sin(a) * (r * 0.8)
            size = 2.5
            fg_draw.ellipse([px - size, py - size, px + size, py + size], fill=(col_acc[0], col_acc[1], col_acc[2], 220))
        frame.alpha_composite(fg)
        
        frames.append(frame)
    return frames

def update_atlases():
    preview = Image.new('RGB', (4 * 256, 4 * 256), '#1e2832')
    draw = ImageDraw.Draw(preview)
    
    for row_idx, (hero_key, cfg) in enumerate(CONFIG.items()):
        frames = create_flip_frames(hero_key, cfg)
        hero_dir = CHARS_DIR / hero_key
        
        # Save individual flip frames
        for f_idx, frame in enumerate(frames):
            frame_name = f'flip-{f_idx:02d}'
            frame.save(hero_dir / f'{frame_name}.png')
            
            # Paste into preview
            px = f_idx * 256
            py = row_idx * 256
            preview.paste(frame, (px, py), frame)
            draw.text((px + 8, py + 236), f'{hero_key}/{frame_name}', fill='white')
        
        # Pack into atlas
        for atlas_name in cfg['atlases']:
            png_path = hero_dir / f'{atlas_name}.png'
            json_path = hero_dir / f'{atlas_name}.json'
            if not png_path.exists() or not json_path.exists():
                continue
            
            atlas_im = Image.open(png_path).convert('RGBA')
            atlas_json = json.loads(json_path.read_text())
            
            if cfg['is_sofia_stella']:
                # Atlas is 2112 x 792 (8 cols x 3 rows of 264 x 264)
                # Row 2 (y = 532) has hit-00 at x = 4; slots 1, 2, 3, 4 are free!
                for f_idx, frame in enumerate(frames):
                    frame_key = f'flip-{f_idx:02d}'
                    slot_col = 1 + f_idx
                    x = slot_col * 264 + 4
                    y = 2 * 264 + 4
                    atlas_im.alpha_composite(frame, (x, y))
                    atlas_json['frames'][frame_key] = {
                        'frame': {'x': x, 'y': y, 'w': 256, 'h': 256},
                        'rotated': False,
                        'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': 256, 'h': 256},
                        'sourceSize': {'w': 256, 'h': 256}
                    }
            else:
                # Air and Earth: expand to 1792 x 1024 (7 cols x 4 rows of 256 x 256)
                new_atlas = Image.new('RGBA', (1792, 1024), (0, 0, 0, 0))
                new_atlas.paste(atlas_im, (0, 0))
                y = 3 * 256  # Row 3
                for f_idx, frame in enumerate(frames):
                    frame_key = f'flip-{f_idx:02d}'
                    x = f_idx * 256
                    new_atlas.alpha_composite(frame, (x, y))
                    atlas_json['frames'][frame_key] = {
                        'frame': {'x': x, 'y': y, 'w': 256, 'h': 256},
                        'rotated': False,
                        'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': 256, 'h': 256},
                        'sourceSize': {'w': 256, 'h': 256}
                    }
                atlas_im = new_atlas
                if 'meta' in atlas_json and 'size' in atlas_json['meta']:
                    atlas_json['meta']['size']['h'] = 1024
            
            atlas_im.save(png_path)
            json_path.write_text(json.dumps(atlas_json, indent=2))
            print(f"Updated {png_path} and {json_path} with flip frames")
    
    preview_path = CHARS_DIR / 'somersault-preview.jpg'
    preview.save(preview_path)
    print(f"Saved preview to {preview_path}")

if __name__ == '__main__':
    update_atlases()
