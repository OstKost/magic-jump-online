import { SPELLS } from './combat';

/** Shared rendering keeps online and Phaser projectiles visually identical. */
export function drawSpell(c:CanvasRenderingContext2D,x:number,y:number,hero:keyof typeof SPELLS,phase:number){
  const color=`#${SPELLS[hero].color.toString(16).padStart(6,'0')}`;
  c.save();c.translate(x,y);c.strokeStyle=color;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=10;c.lineWidth=3;
  if(hero==='kai'){
    c.beginPath();c.moveTo(-22,-8);c.lineTo(0,-3);c.lineTo(-6,5);c.lineTo(23,0);c.stroke();
  }else if(hero==='air'){
    for(let i=-1;i<=1;i++){c.beginPath();c.ellipse(0,i*7,20,4,0,Math.PI,2*Math.PI);c.stroke();}
  }else if(hero==='earth'){
    c.beginPath();c.moveTo(-13,8);c.lineTo(-17,-5);c.lineTo(-3,-13);c.lineTo(13,-7);c.lineTo(17,8);c.lineTo(1,13);c.closePath();c.fill();
  }else if(hero==='leya'){
    for(let i=0;i<3;i++){c.save();c.rotate(phase+i*2.1);c.beginPath();c.ellipse(7,0,12,5,.4,0,Math.PI*2);c.fill();c.restore();}
  }else{
    c.beginPath();c.ellipse(0,0,hero==='stella'?20:14,12,0,0,Math.PI*2);c.fill();
    c.fillStyle='#ffffffaa';c.beginPath();c.ellipse(4,-4,6,4,-.3,0,Math.PI*2);c.fill();
  }
  c.restore();
}
