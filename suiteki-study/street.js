/* Small shared background texture: photograph and distant pedestrians. */
class StreetScene {
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=768;
    this.ctx=this.canvas.getContext('2d',{alpha:false});this.texture=document.createElement('canvas');this.texture.width=this.texture.height=256;this.soft=this.texture.getContext('2d',{alpha:false});this.blur=document.createElement('canvas');this.blur.width=this.blur.height=64;this.blurCtx=this.blur.getContext('2d',{alpha:false});this.image=new Image();this.ready=false;this.last=-1;
    this.image.onload=()=>{this.ready=true;this.last=-1;};
    this.image.onerror=()=>{document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='背景画像を読み込めませんでした。再読み込みしてください。';};
    this.windows=[{x:503,y:332,w:24,h:48,on:true,level:1,next:5+Math.random()*7},{x:550,y:332,w:24,h:49,on:true,level:1,next:10+Math.random()*10}];
    this.cars=[];this.nextCar=3+Math.random()*4;this.image.src='street.jpg';this.people=Array.from({length:10},()=>this.person(Math.random()*900-70));
  }
  person(x){
    const colors=['#18212d','#34303d','#62554b','#29454a','#51303a','#877668','#283443'];
    return {x,dir:Math.random()<.5?-1:1,speed:24+Math.random()*22,h:30+Math.random()*18,
      y:658+Math.random()*8,phase:Math.random()*Math.PI*2,feminine:Math.random()<.5,
      outfit:Math.floor(Math.random()*3),coat:colors[Math.floor(Math.random()*colors.length)],
      umbrella:['#263646','#6e393c','#75634b','#34595c','#403849'][Math.floor(Math.random()*5)],
      design:Math.floor(Math.random()*3),wide:.88+Math.random()*.27,bag:Math.random()<.45};
  }
  drawPerson(p,t){
    const c=this.ctx;const step=Math.sin(t*(5+p.speed*.055)+p.phase);const h=p.h;
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
  car(){
    const dir=Math.random()<.5?-1:1;
    return {x:dir>0?-160:928,dir,speed:(95+Math.random()*70)*1.5,y:698+Math.random()*20,
      style:Math.floor(Math.random()*3),color:['#763e35','#59332f','#365b59','#39485e','#646053'][Math.floor(Math.random()*5)]};
  }
  drawCar(v,t){
    const c=this.ctx;c.save();c.translate(v.x,v.y);c.scale(v.dir,1);
    c.fillStyle='#080d13';c.globalAlpha=.5;c.beginPath();c.ellipse(0,1,66,5,0,0,7);c.fill();c.globalAlpha=1;
    c.fillStyle=v.color;c.beginPath();c.moveTo(-64,-10);c.lineTo(-62,-28);
    if(v.style===0){c.lineTo(-34,-31);c.quadraticCurveTo(-24,-55,6,-52);c.quadraticCurveTo(23,-50,32,-30);}
    else if(v.style===1){c.lineTo(-38,-28);c.lineTo(-22,-45);c.lineTo(12,-45);c.lineTo(32,-28);}
    else {c.lineTo(-62,-38);c.lineTo(-10,-38);c.lineTo(-10,-55);c.quadraticCurveTo(-10,-60,0,-60);c.lineTo(24,-60);c.lineTo(34,-36);c.lineTo(57,-34);}
    c.lineTo(59,-25);c.quadraticCurveTo(69,-22,67,-10);c.closePath();c.fill();
    c.fillStyle='#1a2932';c.beginPath();
    if(v.style===2){c.moveTo(-4,-38);c.lineTo(-4,-54);c.lineTo(20,-54);c.lineTo(27,-38);}
    else {c.moveTo(-23,-32);c.lineTo(-15,v.style===0?-47:-40);c.lineTo(10,v.style===0?-47:-40);c.lineTo(26,-31);}
    c.closePath();c.fill();
    if(v.style===2){c.strokeStyle='#252b2b';c.lineWidth=2;for(let x=-54;x<-12;x+=12){c.beginPath();c.moveTo(x,-35);c.lineTo(x,-20);c.stroke();}}
    c.strokeStyle='#9c9c91';c.lineWidth=1;c.beginPath();c.moveTo(-57,-17);c.lineTo(62,-17);c.moveTo(0,-44);c.lineTo(0,-15);c.stroke();
    for(const x of [-40,42]){c.fillStyle='#0b1016';c.beginPath();c.arc(x,-9,10,0,7);c.fill();c.fillStyle='#777b7a';c.beginPath();c.arc(x,-9,5,0,7);c.fill();c.strokeStyle='#b4b1a3';c.beginPath();c.moveTo(x,-9);c.lineTo(x+Math.cos(t*v.speed*.15)*4,-9+Math.sin(t*v.speed*.15)*4);c.stroke();}
    c.fillStyle='#ffe0a0';c.fillRect(61,-24,5,7);c.fillStyle='#b33224';c.fillRect(-63,-24,4,6);
    c.globalAlpha=.12;c.fillStyle='#eac788';c.beginPath();c.moveTo(65,-18);c.lineTo(160,5);c.lineTo(73,2);c.fill();c.restore();
  }
  drawWindows(dt){
    const c=this.ctx;
    for(const w of this.windows){
      w.next-=dt;if(w.next<=0){w.on=!w.on;w.next=12+Math.random()*28;}
      w.level+=(Number(w.on)-w.level)*Math.min(1,dt*4);
      c.fillStyle='#19282c';c.fillRect(w.x,w.y,w.w,w.h);
      c.globalAlpha=w.level;const light=c.createLinearGradient(0,w.y,0,w.y+w.h);light.addColorStop(0,'#e0aa64');light.addColorStop(1,'#f2c786');c.fillStyle=light;c.fillRect(w.x,w.y,w.w,w.h);c.globalAlpha=1;
      c.strokeStyle='#182326';c.lineWidth=2;c.strokeRect(w.x,w.y,w.w,w.h);c.beginPath();c.moveTo(w.x+w.w*.5,w.y);c.lineTo(w.x+w.w*.5,w.y+w.h);c.moveTo(w.x,w.y+w.h*.46);c.lineTo(w.x+w.w,w.y+w.h*.46);c.stroke();
    }
  }
  update(t){
    if(this.last>=0&&t-this.last<1/24)return false;
    const dt=this.last<0?0:Math.min(t-this.last,.1);this.last=t;const c=this.ctx;
    c.fillStyle='#14212a';c.fillRect(0,0,768,768);if(this.ready)c.drawImage(this.image,0,0,768,768);
    this.drawWindows(dt);
    this.people.sort((a,b)=>a.y-b.y);
    this.people.forEach((p,i)=>{p.x+=p.dir*p.speed*dt;if(p.x < -65||p.x>833){const dir=p.dir;this.people[i]=this.person(dir>0?-60:828);this.people[i].dir=dir;}this.drawPerson(this.people[i],t);});
    this.nextCar-=dt;if(this.nextCar<=0){this.cars.push(this.car());this.nextCar=7+Math.random()*10;}
    this.cars=this.cars.filter(v=>v.x>-180&&v.x<948);
    for(const v of this.cars){v.x+=v.dir*v.speed*dt;this.drawCar(v,t);}
    this.soft.drawImage(this.canvas,0,0,256,256);
    this.blurCtx.drawImage(this.texture,0,0,64,64);
    return true;
  }
}
