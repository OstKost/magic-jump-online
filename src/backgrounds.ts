import Phaser from 'phaser';
import { WORLDS } from './rules';

const WIDTH = 1100, HEIGHT = 300, FLOOR = 276;
// Measured running surfaces in the supplied 2048 × 683 panoramas.
const SURFACE_Y = [570, 540, 575];
interface Layer { sprite: Phaser.GameObjects.TileSprite; speed: number }

export class WorldBackground {
  private layers: Layer[] = [];
  private departureOffset = 0;
  constructor(private scene: Phaser.Scene, private level: number, private count = 2, private speedMultiplier = 1) {
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
    const h = this.scene.scale.height / this.count;
    this.layers.forEach(({ sprite }, i) => {
      sprite.setPosition(0, (i % this.count) * h).setSize(WIDTH, h);
      sprite.tileScaleY = h / HEIGHT;
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
