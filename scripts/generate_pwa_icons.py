#!/usr/bin/env python3
"""Generate PWA icons and preview screenshots for Magic Jump Online."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / 'public' / 'icons'
ICONS_DIR.mkdir(parents=True, exist_ok=True)

BG_COLOR = (19, 36, 49) # #132431

def generate_base_icon():
    # Use 1024x1024 master canvas for super-sampling
    size = 1024
    master = Image.new('RGBA', (size, size), (*BG_COLOR, 255))
    draw = ImageDraw.Draw(master)

    # Decorative radial gradient / glow
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((size * 0.15, size * 0.15, size * 0.85, size * 0.85), fill=(52, 90, 110, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=60))
    master.alpha_composite(glow)

    # Let's check if avatars exist
    sofia_path = ROOT / 'public/assets/characters/sofia/avatar.png'
    stella_path = ROOT / 'public/assets/characters/stella/avatar.png'
    
    if sofia_path.exists() and stella_path.exists():
        sofia = Image.open(sofia_path).convert('RGBA')
        stella = Image.open(stella_path).convert('RGBA')

        # Create dual circular portraits side-by-side or overlapping
        avatar_size = 460
        sofia_scaled = sofia.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        stella_scaled = stella.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)

        # Sofia ring
        draw.ellipse((135, 275, 135 + avatar_size + 10, 275 + avatar_size + 10), fill=(54, 111, 131, 255), outline=(135, 199, 223, 255), width=8)
        master.alpha_composite(sofia_scaled, (140, 280))

        # Stella ring (slight overlap)
        draw.ellipse((425, 275, 425 + avatar_size + 10, 275 + avatar_size + 10), fill=(90, 52, 45, 255), outline=(223, 146, 99, 255), width=8)
        master.alpha_composite(stella_scaled, (430, 280))

        # Golden emblem frame around center
        draw.ellipse((430, 640, 594, 804), fill=(26, 45, 58, 240), outline=(236, 221, 189, 255), width=6)
        
        # Golden text / crest glyphs
        crest_font_size = 72
        # Draw central diamond / crest
        center_x, center_y = 512, 722
        r = 38
        diamond = [(center_x, center_y - r), (center_x + r, center_y), (center_x, center_y + r), (center_x - r, center_y)]
        draw.polygon(diamond, fill=(241, 223, 188, 255), outline=(210, 177, 125, 255))
    else:
        # Fallback to bold stylized glyphs
        draw.ellipse((200, 200, 824, 824), fill=(30, 55, 75, 255), outline=(241, 223, 188, 255), width=16)

    # Border rim
    draw.rounded_rectangle((32, 32, size - 32, size - 32), radius=160, outline=(241, 223, 188, 80), width=8)
    return master

def main():
    master = generate_base_icon()

    # 1. icon-512.png
    icon_512 = master.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(ICONS_DIR / 'icon-512.png', 'PNG')
    print('Generated icon-512.png')

    # 2. icon-192.png
    icon_192 = master.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(ICONS_DIR / 'icon-192.png', 'PNG')
    print('Generated icon-192.png')

    # 3. apple-touch-icon.png (180x180)
    apple_icon = master.resize((180, 180), Image.Resampling.LANCZOS)
    apple_icon.save(ICONS_DIR / 'apple-touch-icon.png', 'PNG')
    # Also save to public root for default Apple crawler
    apple_icon.save(ROOT / 'public' / 'apple-touch-icon.png', 'PNG')
    print('Generated apple-touch-icon.png')

    # 4. icon-512-maskable.png (Safe area is 80% circle, so scaled to ~75% centered with solid background)
    maskable = Image.new('RGBA', (512, 512), (*BG_COLOR, 255))
    inner = master.resize((384, 384), Image.Resampling.LANCZOS)
    maskable.alpha_composite(inner, (64, 64))
    maskable.save(ICONS_DIR / 'icon-512-maskable.png', 'PNG')
    print('Generated icon-512-maskable.png')

    # 5. screenshot-wide.png (1280x720) for rich preview in PWA install dialog
    menu_bg_path = ROOT / 'public/art/menu-background.png'
    if menu_bg_path.exists():
        menu_bg = Image.open(menu_bg_path).convert('RGBA')
        # Center crop or fit to 1280x720
        screen_wide = menu_bg.resize((1280, 720), Image.Resampling.LANCZOS)
        # Add subtle game branding banner
        sw_draw = ImageDraw.Draw(screen_wide)
        sw_draw.rectangle((0, 640, 1280, 720), fill=(16, 34, 49, 210))
        screen_wide.convert('RGB').save(ICONS_DIR / 'screenshot-wide.png', 'PNG')
        print('Generated screenshot-wide.png')

    print('PWA assets generated successfully!')

if __name__ == '__main__':
    main()
