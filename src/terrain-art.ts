/** Shared terrain silhouettes for Phaser and the online Canvas renderer. */
export function drawTerrain(c: CanvasRenderingContext2D, kind: string, width: number, phase = 0) {
  c.save();
  // Eight discrete phases keep both renderers on the same sprite-like cycle.
  const cycle = Math.floor(phase) % 8;
  const wave = Math.sin(cycle * Math.PI / 4);
  if(kind==='platform'){
    c.fillStyle='#5a4030';c.fillRect(-width/2,4,width,16);
    c.fillStyle='#a77b4f';c.fillRect(-width/2,0,width,12);
    c.strokeStyle='#60462e';c.lineWidth=2;
    for(let x=-width/2+36;x<width/2;x+=42){c.beginPath();c.moveTo(x,3);c.lineTo(x,14);c.stroke();}
    c.fillStyle='#a9ce7c';c.fillRect(-width/2,-3,width,5);
    c.strokeStyle='#a9ce7c';c.lineWidth=2;
    for(let x=-width/2+12;x<width/2-8;x+=24){c.beginPath();c.moveTo(x,-2);c.quadraticCurveTo(x+wave*2,-6,x+wave*4,-9);c.stroke();}
  }else if(kind==='gap'){
    c.fillStyle=`rgb(${23+Math.round(wave*2)},${39+Math.round(wave*3)},${52+Math.round(wave*4)})`;c.beginPath();c.moveTo(-width/2,-2);
    for(let x=-width/2;x<=width/2;x+=20)c.lineTo(x,4+Math.sin(x)*5);
    c.lineTo(width/2,42);c.lineTo(-width/2,42);c.closePath();c.fill();
    // The interior shadow moves softly while the rim stays fixed.
    c.save();c.clip();c.fillStyle='rgba(7,15,24,.22)';c.beginPath();c.ellipse(wave*width*.07,23,width*.32,12+wave,0,0,Math.PI*2);c.fill();c.restore();
    c.strokeStyle='#64717a';c.lineWidth=4;c.beginPath();c.moveTo(-width/2,-3);c.lineTo(-width/2+12,24);c.moveTo(width/2,-3);c.lineTo(width/2-12,24);c.stroke();
  }else if(kind==='puddle'){
    c.fillStyle='#287598';c.beginPath();c.ellipse(0,7,width/2,13,0,0,Math.PI*2);c.fill();
    c.fillStyle='#64cce5';c.beginPath();c.ellipse(0,3,width/2-5,7,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#c1f2ff';c.lineWidth=2;
    for(let x=-width/2+25;x<width/2-10;x+=45){c.beginPath();c.ellipse(x+wave*3,3,12+wave*2,2,0,0,Math.PI);c.stroke();}
  }else if(kind==='fire'){
    for(let x=-width/2+20;x<width/2;x+=42){
      c.strokeStyle='#724528';c.lineWidth=8;c.beginPath();c.moveTo(x-15,8);c.lineTo(x+15,1);c.moveTo(x-14,1);c.lineTo(x+14,8);c.stroke();
      for(let layer=0;layer<2;layer++){
        const h=(layer?24:39)*(1+.08*Math.sin(cycle*Math.PI/4+x));
        c.fillStyle=layer?'#ffe58a':'#f7772b';c.beginPath();c.moveTo(x-14+layer*5,2);c.quadraticCurveTo(x-16,-h/2,x+3,-h);c.quadraticCurveTo(x-1,-h/3,x+14-layer*5,2);c.closePath();c.fill();
      }
    }
  }
  c.restore();
}
