import Phaser from 'phaser';

/** A companion keeps its own pace; all timers advance only during active play. */
export class Pet {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly key: string;
  private targetX = 56;
  private changeIn: number;
  private age: number;
  private hop = 0;
  private hopVelocity = 0;
  private jumpIn = -1;
  private ownerAirborne = false;
  private baseScale = 0.65;
  private arenaScale = 1;
  setArenaScale(scale: number) {
    this.arenaScale = scale;
    this.sprite.setScale(this.baseScale * scale);
  }
  private isAnimated: boolean;
  private isMoving = false;
  private reaction = 0;
  react() { this.reaction = .65; }

  constructor(scene: Phaser.Scene, row: number, floor: number, key = row === 0 ? 'black-cat' : 'ginger-cat') {
    this.key = key;
    this.isAnimated = key === 'black-cat' || key === 'ginger-cat';
    
    // Default resting texture at start and waiting
    const restKey = key === 'black-cat' ? 'black-cat-rest'
      : key === 'ginger-cat' ? 'ginger-cat-rest'
      : key === 'falcon' ? 'falcon-rest'
      : key === 'red-panda' ? 'red-panda-rest'
      : key;
    
    const initialTexture = scene.textures.exists(restKey) ? restKey : key;
    this.sprite = scene.add.sprite(this.targetX, floor, initialTexture, 0).setOrigin(.5, 112 / 128);
    this.sprite.setScale(this.baseScale).setDepth(-1);
    this.changeIn = 1.3 + row * 1.1;
    this.age = row * 1.7;
  }

  update(dt: number, floor: number, ownerY: number, _ducking: boolean) {
    this.age += dt;
    if(this.key==='stella-cat'){this.reaction=Math.max(0,this.reaction-dt);this.sprite.setTexture(this.key,this.reaction>0?9+Math.floor(this.age*8)%5:4+Math.floor(this.age*10)%5).setY(floor);return;}
    if(this.key==='sensei-dog'){
      this.reaction=Math.max(0,this.reaction-dt);
      this.sprite.setTexture(this.key, this.reaction>0?7+Math.floor(this.age*8)%4:2+Math.floor(this.age*10)%5);
      this.sprite.y=floor;return;
    }
    this.changeIn -= dt;
    if (this.changeIn <= 0) {
      // Vary the following distance while staying behind the owner at x = 160.
      const positions = [48, 56, 64];
      this.targetX = Phaser.Utils.Array.GetRandom(positions);
      this.changeIn = Phaser.Math.FloatBetween(2.2, 4.6);
    }
    const target = this.targetX;
    const previousX = this.sprite.x;
    this.sprite.x += (target + Math.sin(this.age * 1.6) * 5 - this.sprite.x) * (1 - Math.exp(-dt * 1.8));
    const speed = (this.sprite.x - previousX) / Math.max(dt, .001);
    this.sprite.setScale(this.baseScale * this.arenaScale);

    if (!this.isMoving) {
      this.isMoving = true;
      if (this.isAnimated) {
        if (this.sprite.texture.key !== this.key) this.sprite.setTexture(this.key);
      } else if (this.key === 'eagle' || this.key === 'falcon') {
        const flyKey = this.key === 'falcon' ? 'falcon-fly' : 'eagle-fly';
        if (this.sprite.scene.textures.exists(flyKey)) {
          this.sprite.setTexture(flyKey);
          this.sprite.setOrigin(.5, 104 / 128);
        }
      } else if (this.key === 'fox' || this.key === 'red-panda') {
        const runKey = this.key === 'red-panda' ? 'red-panda-run' : 'fox-run';
        if (this.sprite.scene.textures.exists(runKey)) {
          this.sprite.setTexture(runKey);
          this.sprite.setOrigin(.5, 112 / 128);
        }
      }
    }

    if (this.isAnimated) {
      this.sprite.play(`${this.key}-run`, true);
      this.sprite.anims.timeScale = Phaser.Math.Clamp(1 + speed / 150, .7, 1.7);
    }

    // React a little later than the owner, then complete an independent small hop.
    if (ownerY < 0 && !this.ownerAirborne && this.hop === 0) this.jumpIn = .10 + (Math.sin(this.age) + 1) * .07;
    this.ownerAirborne = ownerY < 0;
    if (this.jumpIn >= 0) {
      this.jumpIn -= dt;
      if (this.jumpIn <= 0) { this.hopVelocity = -330; this.jumpIn = -1; }
    }
    if (this.hop < 0 || this.hopVelocity < 0) {
      this.hopVelocity += 1150 * dt;
      this.hop = Math.min(0, this.hop + this.hopVelocity * dt);
      if (this.hop === 0) this.hopVelocity = 0;
    }

    if (this.key === 'eagle' || this.key === 'falcon') {
      const flightHover = -16 + Math.sin(this.age * 6) * 5;
      this.sprite.y = floor + (flightHover + this.hop) * this.arenaScale;
    } else {
      const trot = this.isAnimated ? 0 : Math.sin(this.age * 12) * 2;
      this.sprite.y = floor + (this.hop + trot) * this.arenaScale;
    }
  }

  idle(dt: number, floor: number) {
    if(this.key==='stella-cat'){this.age+=dt;this.sprite.setTexture(this.key,Math.floor(this.age*5)%4).setY(floor);return;}
    if(this.key==='sensei-dog'){this.age+=dt;this.sprite.setTexture(this.key,Math.floor(this.age*2)%2).setY(floor);return;}
    this.age += dt;
    this.sprite.stop();
    this.isMoving = false;

    const restKey = this.key === 'black-cat' ? 'black-cat-rest'
      : this.key === 'ginger-cat' ? 'ginger-cat-rest'
      : this.key === 'eagle' ? 'eagle'
      : this.key === 'falcon' ? 'falcon-rest'
      : this.key === 'red-panda' ? 'red-panda-rest'
      : 'fox';
    
    if (this.sprite.texture.key !== restKey && this.sprite.scene.textures.exists(restKey)) {
      this.sprite.setTexture(restKey);
    }
    this.sprite.setOrigin(.5, 112 / 128);
    this.sprite.y = floor;
    this.sprite.setScale(this.baseScale * this.arenaScale, this.baseScale * this.arenaScale * (1 + Math.sin(this.age * 2.5) * .025));
  }

  stop() {
    this.sprite.stop();
    this.isMoving = false;
  }
}
