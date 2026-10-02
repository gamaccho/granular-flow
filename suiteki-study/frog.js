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
      const hipX=side*(back?22:18),hipY=back?28:-25,kneeX=side*(back?55:38),kneeY=back?46:-24;
      c.lineCap='round';c.lineJoin='round';c.strokeStyle='#456444';c.lineWidth=back?18:11;c.beginPath();c.moveTo(hipX,hipY);c.lineTo(kneeX,kneeY);c.lineTo(footX,footY);c.stroke();
      c.strokeStyle='#9eae79';c.lineWidth=back?11:6;c.stroke();
      for(let toe=0;toe<(back?5:4);toe++){
        const angle=-Math.PI/2+(toe-1.5)*.48;const tx=footX+Math.cos(angle)*18,ty=footY+Math.sin(angle)*(back?16:21);
        c.strokeStyle='#a4b887';c.lineWidth=3;c.beginPath();c.moveTo(footX,footY);c.quadraticCurveTo(footX+(tx-footX)*.6,footY-7,tx,ty);c.stroke();
        ellipse(tx,ty,4.5-lift*1.3,3.6-lift,'#c3cb97');if(lift<.2){c.strokeStyle='rgba(224,225,167,.45)';c.lineWidth=.8;c.stroke();}
      }
    }
    ellipse(0,5,29,46,'#4d714a');
    const belly=c.createRadialGradient(-7,-5,3,0,5,43);belly.addColorStop(0,'#c7ca91');belly.addColorStop(.72,'#a8b27c');belly.addColorStop(1,'#6b8556');ellipse(0,6,24,39,belly);
    ellipse(0,-36,31,24,'#859c66');ellipse(0,-30,23,15,'#c2c897');
    for(const side of [-1,1]){ellipse(side*24,-49,10,12,'#647c47');ellipse(side*27,-53,5,5,'#b6ad62');ellipse(side*28,-54,2,3,'#293128');}
    c.strokeStyle='rgba(86,102,57,.45)';c.lineWidth=1;c.beginPath();c.arc(0,-37,18,.2,Math.PI-.2);c.stroke();
    for(let i=0;i<23;i++){const x=Math.sin(i*19.3)*18,y=Math.cos(i*7.7)*28+7;ellipse(x,y,1.1,1.5,'rgba(93,119,65,.20)');}
    // Very slight breathing while the belly faces the room.
    ellipse(0,-23,13,5+Math.sin(a*3)*.7,'rgba(215,213,154,.25)');c.restore();
  }
}
if(typeof module!=='undefined')module.exports=FrogVisitor;
