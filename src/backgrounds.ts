import Phaser from 'phaser';
import { WORLDS } from './rules';

const WIDTH = 1100, HEIGHT = 300, FLOOR = 276;
// Measured running surfaces in the supplied 2048 × 683 panoramas.
const SURFACE_Y = [570, 540, 575, 535, 518];
const MAX_SCALE_Y = 1.15;
const SKY_COLORS = [
  { top: 0x5a8ecf, bottom: 0x73a1df }, // Level 0: Sofia Air Sky
  { top: 0x1e5a96, bottom: 0x5096d2 }, // Level 1: Stella Earth Sky
  { top: 0x020a1e, bottom: 0x071646 }, // Level 2: Night Sky
  { top: 0x284f50, bottom: 0x66977c },
  { top: 0xd79864, bottom: 0xedbd68 },
];
const GROUND_COLORS = [
  0x271a20, // Level 0: Earth soil
  0x4d1b12, // Level 1: Autumn red clay
  0x0c1026, // Level 2: Night dark ground
  0x384633, 0xb77e40,
];
interface Layer { sprite: Phaser.GameObjects.TileSprite; speed: number }

export class WorldBackground {
  private layers: Layer[] = [];
  private departureOffset = 0;
  private skyGraphics: Phaser.GameObjects.Graphics;
  private groundGraphics: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene, private level: number, private count = 2, private speedMultiplier = 1) {
    this.skyGraphics = scene.add.graphics().setDepth(-20);
    this.groundGraphics = scene.add.graphics().setDepth(-11);
    const panorama = scene.textures.get(`panorama-${level}`).getSourceImage() as HTMLImageElement;
    for (let layer = 0; layer < 2; layer++) {
      const key = `world-${level}-panorama-${layer}`;
      if (!scene.textures.exists(key)) {
        const texture = scene.textures.createCanvas(key, WIDTH * 2, HEIGHT)!;
        const c = texture.context;
        const surface = SURFACE_Y[level];
        // Reflect the second tile so both wrap boundaries meet without a hard cut.
        for (let tile = 0; tile < 2; tile++) {
          c.save();
          c.translate(tile === 0 ? 0 : WIDTH * 2, 0);
          c.scale(tile === 0 ? 1 : -1, 1);
          if (layer === 0) {
            c.drawImage(panorama, 0, 0, panorama.width, surface, 0, 0, WIDTH, FLOOR);
          } else if (level === 0) {
            const floor = scene.textures.get('level-1-floor').getSourceImage() as HTMLImageElement;
            const scale = WIDTH / floor.width;
            // The stone path meets the runners at source y=320; preserve the artwork proportions.
            c.drawImage(floor, 0, FLOOR - 320 * scale, WIDTH, floor.height * scale);
          } else {
            c.drawImage(panorama, 0, surface, panorama.width, panorama.height - surface, 0, FLOOR, WIDTH, HEIGHT - FLOOR);
          }
          c.restore();
        }
        texture.refresh();
      }
      for (let row = 0; row < this.count; row++) {
        const sprite = scene.add.tileSprite(0, 0, WIDTH, HEIGHT, key).setOrigin(0).setDepth(-10 + layer);
        this.layers.push({ sprite, speed: layer === 0 ? 3 : WORLDS[level].speed * this.speedMultiplier });
      }
    }
    this.resize();
  }
  resize() {
    const laneHeight = this.scene.scale.height / this.count;
    const scaleY = Math.min(laneHeight / HEIGHT, MAX_SCALE_Y);

    this.skyGraphics.clear();
    this.groundGraphics.clear();

    const sky = SKY_COLORS[this.level] ?? SKY_COLORS[0];
    const groundColor = GROUND_COLORS[this.level] ?? GROUND_COLORS[0];

    for (let row = 0; row < this.count; row++) {
      const floorY = (row + 0.92) * laneHeight;
      const sceneryTop = floorY - FLOOR * scaleY;
      const rowTop = row * laneHeight;
      const rowBottom = (row + 1) * laneHeight;

      if (sceneryTop > rowTop) {
        this.skyGraphics.fillGradientStyle(sky.top, sky.top, sky.bottom, sky.bottom, 1);
        this.skyGraphics.fillRect(0, rowTop, WIDTH, sceneryTop - rowTop + 2);
      }
      this.groundGraphics.fillStyle(groundColor, 1);
      this.groundGraphics.fillRect(0, floorY - 1, WIDTH, rowBottom - floorY + 1);
    }

    this.layers.forEach(({ sprite }, i) => {
      const row = i % this.count;
      const layer = Math.floor(i / this.count);
      const floorY = (row + 0.92) * laneHeight;
      const sceneryTop = floorY - FLOOR * scaleY;

      if (layer === 0) {
        const sceneryHeight = FLOOR * scaleY;
        sprite.setPosition(0, sceneryTop).setSize(WIDTH, sceneryHeight);
        sprite.tileScaleX = 1;
        sprite.tileScaleY = scaleY;
      } else {
        sprite.setPosition(0, sceneryTop).setSize(WIDTH, HEIGHT * scaleY);
        sprite.tileScaleX = 1;
        sprite.tileScaleY = scaleY;
      }
    });
  }
  update(dt: number, time: number) {
    // Leave the entrance temple during the first 2.5 seconds of running.
    // Use gameplay time so readiness and pauses also freeze this movement.
    const progress = Math.min(1, Math.max(0, time / 2500));
    const offset = this.level === 0 ? 180 * (1 - Math.pow(1 - progress, 3)) : 0;
    const departure = offset - this.departureOffset;
    this.departureOffset = offset;
    this.layers.forEach(({ sprite, speed }) => {
      sprite.tilePositionX += speed * dt + (speed === 3 ? departure : 0);
    });
  }
}
