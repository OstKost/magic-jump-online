import Phaser from 'phaser';
import { WORLDS } from './rules';

// All layers tile seamlessly and share a 1100 × 300 design space.
const WIDTH = 1100, HEIGHT = 300;
interface Layer { sprite: Phaser.GameObjects.TileSprite; speed: number; shimmer: boolean }
export class WorldBackground {
  private layers: Layer[] = [];
  constructor(private scene: Phaser.Scene, level: number, private count = 2) {
    for (let layer = 0; layer < 4; layer++) {
      const key = `world-${level}-${layer}`;
      if (!scene.textures.exists(key)) {
        const texture = scene.textures.createCanvas(key, WIDTH, HEIGHT)!;
        if (level === 0 && layer === 0) {
          const panorama = scene.textures.get('candy-panorama').getSourceImage() as HTMLImageElement;
          // The generated icing starts at 78.3%: align it to the runners' floor.
          texture.context.drawImage(panorama, 0, 0, WIDTH, 276 / .783);
        } else if (level === 0 && layer === 3) {
          const panorama = scene.textures.get('candy-panorama').getSourceImage() as HTMLImageElement;
          texture.context.drawImage(panorama, 0, panorama.height * .783, panorama.width, panorama.height * .09, 0, 276, WIDTH, 24);
        } else {
          paint(texture.context, level, layer);
        }
        texture.refresh();
      }
      for (let row = 0; row < this.count; row++) {
        const sprite = scene.add.tileSprite(0, 0, WIDTH, HEIGHT, key).setOrigin(0).setDepth(-10 + layer);
        this.layers.push({ sprite, speed: [level === 0 ? 12 : 3, 12, 28, WORLDS[level].speed][layer], shimmer: level === 2 && layer === 2 });
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
    this.layers.forEach(({ sprite, speed, shimmer }) => {
      sprite.tilePositionX += speed * dt;
      if (shimmer) sprite.alpha = .7 + Math.sin(time / 850) * .25;
    });
  }
}

function paint(c: CanvasRenderingContext2D, world: number, layer: number) {
  let seed = 719 + world * 97 + layer * 133;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  };
  if (layer === 0) {
    const sky = c.createLinearGradient(0, 0, 0, HEIGHT);
    const colors = [['#9edced', '#ffe1ef'], ['#103d38', '#90b994'], ['#080c29', '#372856']][world];
    sky.addColorStop(0, colors[0]); sky.addColorStop(1, colors[1]);
    c.fillStyle = sky; c.fillRect(0, 0, WIDTH, HEIGHT);
    if (world === 2) {
      for (const [x,y,r,color] of [[280,100,250,'rgba(112,65,184,.35)'],[820,180,290,'rgba(44,141,170,.22)']] as const) {
        const glow = c.createRadialGradient(x,y,0,x,y,r); glow.addColorStop(0,color); glow.addColorStop(1,'transparent');
        c.fillStyle=glow;c.fillRect(0,0,WIDTH,HEIGHT);
      }
      ellipse(875, 66, 25, 25, '#d9dcff'); ellipse(885, 59, 23, 23, '#202444');
    }
  }
  if (world === 0) {
    // The generated panorama supplies the sky, distant mountains and candy valley.
    // Keep the middle planes clear so they do not obscure its lighting and depth.
  } else if (world === 1) {
    if (layer === 1 || layer === 2) {
      const spacing = layer === 1 ? 27 : 67;
      for(let x=10;x<WIDTH;x+=spacing){
        const top=random()*65-30, w=layer===1?9:16;
        const green=layer===1?'#376e58':'#528e50';
        c.fillStyle=green;c.fillRect(x,top,w,HEIGHT-top);
        c.fillStyle=layer===1?'#50816b':'#91ba65';c.fillRect(x+2,top,2,HEIGHT-top);
        for(let y=top+30;y<270;y+=39){
          c.fillStyle=layer===1?'#779a74':'#bfce7e';c.fillRect(x-1,y,w+2,3);
          for(const side of [-1,1]){c.save();c.translate(x+w/2,y);c.rotate(side*.5);ellipse(side*19,-10,24,4,green);c.restore();}
        }
      }
      if(layer===2){c.fillStyle='rgba(180,219,164,.09)';c.beginPath();c.moveTo(280,0);c.lineTo(360,0);c.lineTo(680,276);c.lineTo(460,276);c.fill();}
    }
  } else if (layer === 1 || layer === 2) {
    for(let i=0;i<(layer===1?160:35);i++){
      const x=4+random()*(WIDTH-8),y=12+random()*243,r=layer===1?.5+random():1+random()*1.3;
      ellipse(x,y,r,r,layer===1?'#b3c4ed':'#fff5d9');
      if(layer===2&&i%4===0){c.strokeStyle='#d1ddff';c.lineWidth=.8;c.beginPath();c.moveTo(x-5,y);c.lineTo(x+5,y);c.moveTo(x,y-5);c.lineTo(x,y+5);c.stroke();}
    }
  }
  if (layer === 3) {
    const ground = [['#fff3df','#dd96b7','#f7c9d9'],['#b2c48b','#446847','#77995c'],['#b4a9d9','#292840','#5c527e']][world];
    c.fillStyle=ground[1];c.fillRect(0,276,WIDTH,24);
    c.fillStyle=ground[0];c.fillRect(0,276,WIDTH,3);
    for(let x=12;x<WIDTH;x+=27){
      c.fillStyle=ground[2];
      if(world===0){c.save();c.translate(x,288);c.rotate(.5);c.fillRect(-4,-1,8,3);c.restore();}
      else if(world===1){ellipse(x,286,7,2,ground[2]);}
      else {ellipse(x,288,2,1,ground[2]);}
    }
    if(world===1){for(let i=0;i<13;i++)ellipse(random()*WIDTH,65+random()*180,1.5,1.5,'#e4ebad');}
  }
}
