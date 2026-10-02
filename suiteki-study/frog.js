/* Original ventral frog drawing; toe-placement inspired by Endlein et al. (2013), Video S2. */
class FrogVisitor {
  constructor(random=Math.random){this.random=random;this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=256;this.c=this.canvas.getContext('2d');this.reset();}
  reset(){this.clock=0;this.next=36+this.random()*8;this.age=-1;this.rect=[0,0,0,0];this.c.clearRect(0,0,256,256);}
  update(dt,w,h){
    this.clock+=dt;
    if(this.age<0&&this.clock>=this.next){this.age=0;this.next=this.clock+36+this.random()*8;this.side=this.random()<.5?-1:1;this.baseY=.38+this.random()*.25;this.size=Math.min(190,Math.min(w,h)*.40);}
    if(this.age<0)return false;
    this.age+=dt;const a=this.age;
    if(a>12){this.age=-1;this.rect=[0,0,0,0];return false;}
    const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const enter=ease(a/1.1),leave=ease((a-10.6)/1.4);
    const climb=Math.floor(Math.max(0,a-2)/1.2)+ease((Math.max(0,a-2)%1.2-.72)/.48);
    const x=w*(this.side<0?.28:.72)+this.side*((1-enter)*(w*.85)+leave*w*.85)+Math.sin(climb*.5)*this.size*.12;
    const y=h*this.baseY-climb*this.size*.047-leave*this.size*.65;
    this.rect=[x/w,1-y/h,this.size/w,this.size/h];
    this.draw(a,climb,leave);return true;
  }
  draw(a,climb,leave){
    const c=this.c;c.clearRect(0,0,256,256);c.save();c.translate(128,130);c.rotate(this.side*.18+leave*this.side*.45);c.scale(1-leave*.30,1-leave*.30);
    const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
    const phase=Math.max(0,a-1.8)/1.2;
    // One foot releases at a time. Other feet counter body travel and stay planted.
    for(let i=0;i<4;i++){
      const side=i%2?-1:1,back=i>=2;const q=phase+i*.25;const cycle=q-Math.floor(q);const swing=Math.max(0,(cycle-.72)/.28);const eased=swing*swing*(3-2*swing);
      const lift=Math.sin(swing*Math.PI);const footX=side*(back?68:61)+side*lift*6;
      const footY=(back?53:-57)+(cycle-eased)*15-leave*(back?-30:18);
      const hipX=side*(back?22:18),hipY=back?28:-25,kneeX=side*(back?55:38),kneeY=back?12:-18;
      c.lineCap='round';c.lineJoin='round';c.strokeStyle='#78816a';c.lineWidth=back?19:9;c.beginPath();c.moveTo(hipX,hipY);c.lineTo(kneeX,kneeY);c.lineTo(footX,footY);c.stroke();
      c.strokeStyle='#b1ad8f';c.lineWidth=back?12:5;c.stroke();
      for(let toe=0;toe<(back?5:4);toe++){
        const angle=-Math.PI/2+(toe-1.5)*.48;const tx=footX+Math.cos(angle)*18,ty=footY+Math.sin(angle)*(back?16:21);
        c.strokeStyle='#b3ad91';c.lineWidth=3;c.beginPath();c.moveTo(footX,footY);c.quadraticCurveTo(footX+(tx-footX)*.6,footY-7,tx,ty);c.stroke();
        ellipse(tx,ty,4.5-lift*1.3,3.6-lift,'#bdb394');if(lift<.2){c.strokeStyle='rgba(224,225,167,.45)';c.lineWidth=.8;c.stroke();}
      }
    }
    // Irregular pear-shaped underside, with subdued olive flanks and translucent belly.
    c.beginPath();c.moveTo(-19,-35);c.bezierCurveTo(-30,-17,-29,8,-23,29);c.bezierCurveTo(-18,49,10,52,21,31);c.bezierCurveTo(30,11,28,-18,18,-35);c.closePath();
    const belly=c.createRadialGradient(-8,-9,2,2,3,48);belly.addColorStop(0,'#c6bca0');belly.addColorStop(.55,'#aaa78b');belly.addColorStop(.84,'#8b9274');belly.addColorStop(1,'#657457');c.fillStyle=belly;c.fill();
    c.save();c.clip();
    for(let i=0;i<460;i++){const x=Math.sin(i*19.31)*31,y=Math.cos(i*7.713)*49;const r=.35+(i%5)*.19;ellipse(x,y,r,r*.74,i%3?'rgba(76,87,61,.12)':'rgba(219,205,170,.18)');}
    c.strokeStyle='rgba(134,98,77,.15)';c.lineWidth=.5;
    for(let i=0;i<8;i++){const y=-15+i*6;c.beginPath();c.moveTo(-19,y);c.quadraticCurveTo(-7,y+3,-2,y+8);c.moveTo(20,y+1);c.quadraticCurveTo(8,y+4,2,y+9);c.stroke();}
    c.restore();
    const throat=c.createRadialGradient(-4,-33,1,0,-31,29);throat.addColorStop(0,'#bcb59b');throat.addColorStop(1,'#7b8768');
    c.beginPath();c.moveTo(-24,-35);c.bezierCurveTo(-29,-48,-18,-57,0,-58);c.bezierCurveTo(19,-57,29,-46,24,-34);c.quadraticCurveTo(0,-15,-24,-35);c.fillStyle=throat;c.fill();
    // Eyes are mostly occluded from below; avoid front-facing cartoon pupils or a smile.
    ellipse(-23,-49,5.5,8,'#6e795b');ellipse(23,-49,5,7,'#72795b');
    c.strokeStyle='rgba(76,81,58,.20)';c.lineWidth=.65;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-14,-28+i*2);c.quadraticCurveTo(0,-24+i*2,14,-29+i*2);c.stroke();}
    ellipse(0,-27,12,5+Math.sin(a*3)*.45,'rgba(207,194,163,.09)');c.restore();
  }
}
if(typeof module!=='undefined')module.exports=FrogVisitor;
