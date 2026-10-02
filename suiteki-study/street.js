/* Small shared background texture: photograph and distant pedestrians. */
class StreetScene {
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=768;
    this.ctx=this.canvas.getContext('2d',{alpha:false});this.texture=document.createElement('canvas');this.texture.width=this.texture.height=128;this.soft=this.texture.getContext('2d',{alpha:false});this.image=new Image();this.ready=false;this.last=-1;
    this.image.onload=()=>{this.ready=true;this.last=-1;};
    this.image.onerror=()=>{document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='背景画像を読み込めませんでした。再読み込みしてください。';};
    this.image.src='street.jpg';this.people=Array.from({length:10},()=>this.person(Math.random()*900-70));
  }
  person(x){
    const colors=['#18212d','#34303d','#62554b','#29454a','#51303a','#877668','#283443'];
    return {x,dir:Math.random()<.5?-1:1,speed:8+Math.random()*17,h:30+Math.random()*18,
      y:658+Math.random()*8,phase:Math.random()*Math.PI*2,feminine:Math.random()<.5,
      outfit:Math.floor(Math.random()*3),coat:colors[Math.floor(Math.random()*colors.length)],
      umbrella:['#263646','#6e393c','#75634b','#34595c','#403849'][Math.floor(Math.random()*5)],
      design:Math.floor(Math.random()*3),wide:.88+Math.random()*.27,bag:Math.random()<.45};
  }
  drawPerson(p,t){
    const c=this.ctx;const step=Math.sin(t*p.speed*.24+p.phase);const h=p.h;
    c.save();c.translate(p.x,p.y);c.scale(p.dir,1);
    c.fillStyle='#070d14';c.globalAlpha=.38;c.beginPath();c.ellipse(0,1,h*.22,2,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    c.translate(0,-Math.abs(step)*h*.013);
    c.strokeStyle='#141923';c.lineWidth=h*.075;c.lineCap='round';
    for(const side of [-1,1]){c.beginPath();c.moveTo(side*h*.055,-h*.39);c.lineTo(side*step*h*.09,-h*.20);c.lineTo(side*step*h*.18,0);c.stroke();}
    c.fillStyle=p.coat;c.beginPath();c.moveTo(-h*.12,-h*.73);c.lineTo(h*.12,-h*.73);
    const hem=p.outfit===0?.27:.40;const spread=p.outfit===2&&p.feminine?.23:.14;
    c.lineTo(h*spread,-h*hem);c.lineTo(-h*spread,-h*hem);c.closePath();c.fill();
    c.fillStyle='#80736a';c.beginPath();c.ellipse(0,-h*.84,h*.076,h*.093,0,0,Math.PI*2);c.fill();
    c.fillStyle='#171820';c.beginPath();c.ellipse(-h*.015,-h*.875,h*.085,h*(p.feminine?.12:.06),0,0,Math.PI*2);c.fill();
    c.strokeStyle=p.coat;c.lineWidth=h*.06;c.beginPath();c.moveTo(h*.09,-h*.69);c.lineTo(h*.16,-h*.52);c.lineTo(h*.23,-h*.64);c.stroke();
    if(p.bag){c.fillStyle='#372d2c';c.fillRect(-h*.22,-h*.43,h*.13,h*.19);}
    c.strokeStyle='#96908a';c.lineWidth=.8;c.beginPath();c.moveTo(h*.22,-h*.57);c.lineTo(h*.22,-h*1.17);c.stroke();
    c.translate(h*.19+step*.3,-h*1.08);c.rotate(-.045*p.dir);const w=h*.57*p.wide;
    c.beginPath();c.moveTo(-w,0);c.bezierCurveTo(-w*.78,-w*.86,w*.78,-w*.86,w,0);c.quadraticCurveTo(w*.5,-w*.12,0,0);c.quadraticCurveTo(-w*.5,-w*.12,-w,0);c.closePath();
    c.fillStyle=p.umbrella;c.fill();c.save();c.clip();
    c.strokeStyle=p.design===1?'#ada997':'#859296';c.globalAlpha=p.design===1?.5:.25;c.lineWidth=p.design===1?2:1;
    for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(0,-w*.66);c.quadraticCurveTo(i*w*.25,-w*.35,i*w*.44,2);c.stroke();}
    if(p.design===2){c.fillStyle='#b2aba0';for(let i=0;i<12;i++){c.beginPath();c.arc((i%4-1.5)*w*.4,-(Math.floor(i/4)+.5)*w*.19,1.2,0,7);c.fill();}}
    c.restore();c.restore();
  }
  update(t){
    if(this.last>=0&&t-this.last<1/24)return false;
    const dt=this.last<0?0:Math.min(t-this.last,.1);this.last=t;const c=this.ctx;
    c.fillStyle='#14212a';c.fillRect(0,0,768,768);if(this.ready)c.drawImage(this.image,0,0,768,768);
    this.people.sort((a,b)=>a.y-b.y);
    this.people.forEach((p,i)=>{p.x+=p.dir*p.speed*dt;if(p.x < -65||p.x>833){const dir=p.dir;this.people[i]=this.person(dir>0?-60:828);this.people[i].dir=dir;}this.drawPerson(this.people[i],t);});
    this.soft.drawImage(this.canvas,0,0,128,128);
    return true;
  }
}
