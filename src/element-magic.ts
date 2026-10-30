import Phaser from 'phaser';

type MagicMode = 'jump' | 'duck' | 'none';
interface Spark { x:number; y:number; vx:number; vy:number; age:number; life:number; size:number }

/** Sprite artwork carries the magic; this layer adds only quiet, close-range accents. */
export class ElementMagic {
  private graphics:Phaser.GameObjects.Graphics;
  private sparks:Spark[]=[];
  private phase=0;
  private emission=0;
  private previous:MagicMode='none';
  private color:number;
  private fire: boolean;
  private water: boolean;
  constructor(scene:Phaser.Scene, fireOrHero: boolean | string){
    this.graphics=scene.add.graphics().setDepth(.1);
    this.fire = typeof fireOrHero === 'boolean' ? fireOrHero : (fireOrHero === 'stella' || fireOrHero === 'Огонь' || fireOrHero === 'fire');
    this.water=typeof fireOrHero==='boolean'?!fireOrHero:fireOrHero==='sofia';
    this.color=this.fire?0xffc474:fireOrHero==='earth'?0xb5c694:fireOrHero==='air'?0xc7efdf:0xb4ecf7;
  }
  clear(){this.graphics.clear();this.sparks=[];this.previous='none';this.emission=0;}
  update(dt:number,x:number,y:number,ground:number,mode:MagicMode,speed:number){
    this.phase+=dt;
    const g=this.graphics;g.clear().setPosition(x,ground);
    if(this.previous==='jump'&&mode!=='jump'&&Math.abs(y-ground)<1){
      for(let i=0;i<3;i++)this.emit(-5,-3);
    }
    this.previous=mode;
    if(mode!=='none'){
      const lift=y-ground;
      // A faint, short ripple hugs the boot; no separate large ribbon or flame.
      if(this.water){
        const pulse=(this.phase*2)%1;
        g.lineStyle(.65,this.color,(1-pulse)*.16);
        g.beginPath();
        for(let i=0;i<=12;i++){
          const t=i/12,px=-16+t*23,py=lift-3-Math.sin(t*Math.PI)*(1+pulse*2);
          if(i===0)g.moveTo(px,py);else g.lineTo(px,py);
        }
        g.strokePath();
      }
      this.emission+=dt*7;
      while(this.emission>=1){this.emission--;this.emit(-8+Math.random()*10,lift-5-Math.random()*7);}
    }else this.emission=0;
    this.sparks=this.sparks.filter(p=>p.age<p.life);
    for(const p of this.sparks){
      p.age+=dt;p.x+=(p.vx-speed*.035)*dt;p.y+=p.vy*dt;
      const fade=Math.max(0,1-p.age/p.life);
      g.fillStyle(this.color,fade*.28);
      g.fillCircle(p.x,p.y,p.size*fade);
    }
  }
  private emit(x:number,y:number){
    if(this.sparks.length>=8)return;
    this.sparks.push({x,y,vx:-4-Math.random()*8,vy:(this.fire?-1:1)*(4+Math.random()*7),
      age:0,life:.18+Math.random()*.16,size:.45+Math.random()*.55});
  }
}
