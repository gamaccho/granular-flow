/* Small shared background texture: photograph and distant pedestrians. */
class StreetScene {
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=768;
    this.ctx=this.canvas.getContext('2d',{alpha:false});this.texture=document.createElement('canvas');this.texture.width=this.texture.height=256;this.soft=this.texture.getContext('2d',{alpha:false});this.blur=document.createElement('canvas');this.blur.width=this.blur.height=64;this.blurCtx=this.blur.getContext('2d',{alpha:false});this.image=new Image();this.ready=false;this.last=-1;
    this.image.onload=()=>{this.ready=true;this.last=-1;};
    this.image.onerror=()=>{document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='背景画像を読み込めませんでした。再読み込みしてください。';};
    this.windows=[{x:503,y:332,w:24,h:48,on:true,top:'#e0aa64',bottom:'#f2c786',next:5+Math.random()*7},{x:299,y:326,w:25,h:51,on:true,top:'#b97842',bottom:'#ce9254',next:10+Math.random()*10}];
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
    const palette=['#842d35','#3a5e48','#284d67','#98642f','#62486d','#24736c','#925142','#292d35','#766333','#4d3c30','#465b83','#733e61'];
    const previous=this.lastCar;
    const dir=previous?-previous.dir:(Math.random()<.5?-1:1);
    const styles=[0,1,2].filter(v=>!previous||v!==previous.style);
    const colors=palette.filter(v=>!previous||v!==previous.color);
    const car={x:dir>0?-190:958,dir,speed:(213.75+Math.random()*33.75)*1.3,y:716+Math.random()*18,
      style:styles[Math.floor(Math.random()*styles.length)],color:colors[Math.floor(Math.random()*colors.length)]};
    this.lastCar=car;return car;
  }
  drawCar(v,t){
    const c=this.ctx;c.save();c.translate(v.x,v.y);const scale=v.style===2?1.72:1.52;c.scale(v.dir*scale,scale);
    const oval=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,7);c.fill();};
    oval(0,2,69,5,'rgba(5,9,14,.5)');
    // Rounded rear-engine compact, upright retro saloon, and rounded-fender pickup.
    c.beginPath();c.moveTo(-63,-12);
    if(v.style===0){c.bezierCurveTo(-68,-34,-43,-55,-27,-56);c.bezierCurveTo(-11,-60,8,-57,18,-47);c.quadraticCurveTo(31,-30,44,-29);c.quadraticCurveTo(65,-27,65,-12);}
    else if(v.style===1){c.lineTo(-61,-43);c.quadraticCurveTo(-57,-61,-46,-62);c.lineTo(7,-62);c.quadraticCurveTo(15,-62,20,-52);c.lineTo(30,-36);c.quadraticCurveTo(59,-37,64,-28);c.lineTo(65,-12);}
    else {c.lineTo(-66,-37);c.lineTo(-10,-37);c.lineTo(-10,-60);c.quadraticCurveTo(-8,-67,5,-67);c.lineTo(24,-67);c.quadraticCurveTo(31,-66,33,-54);c.lineTo(34,-35);c.quadraticCurveTo(63,-37,68,-22);c.lineTo(68,-12);}
    c.closePath();const body=c.createLinearGradient(0,-65,0,0);body.addColorStop(0,v.color);body.addColorStop(.55,v.color);body.addColorStop(1,'#1c2429');c.fillStyle=body;c.fill();
    c.fillStyle='#283c45';c.beginPath();
    if(v.style===0){c.moveTo(-42,-34);c.quadraticCurveTo(-35,-53,-25,-52);c.lineTo(4,-51);c.lineTo(18,-33);}
    else if(v.style===1){c.moveTo(-49,-38);c.lineTo(-46,-56);c.lineTo(5,-56);c.lineTo(23,-37);}
    else {c.moveTo(-4,-38);c.lineTo(-4,-59);c.quadraticCurveTo(5,-63,24,-59);c.lineTo(27,-38);}
    c.closePath();c.fill();c.strokeStyle='rgba(156,184,183,.45)';c.lineWidth=1;c.stroke();
    c.strokeStyle=v.color;c.lineWidth=3;c.beginPath();c.moveTo(v.style===2?5:-17,-57);c.lineTo(v.style===2?5:-17,-34);c.stroke();
    if(v.style===2){c.fillStyle='#231e21';c.fillRect(-62,-37,50,5);c.strokeStyle='#784c47';c.lineWidth=1;c.strokeRect(-62,-36,50,18);}
    // Separate bulbous fenders, chrome sill, bumper and round lamps.
    for(const x of [-40,42]){oval(x,-14,18,v.style===2?19:16,v.color);oval(x,-9,11,11,'#10151a');oval(x,-9,6,6,v.style===2?v.color:'#7a8385');c.strokeStyle='#b0a892';c.lineWidth=.7;c.beginPath();c.arc(x,-9,5,t*v.speed*.08,t*v.speed*.08+2.4);c.stroke();}
    c.strokeStyle='#8b9695';c.lineWidth=1.4;c.beginPath();c.moveTo(-22,-13);c.lineTo(24,-13);c.moveTo(57,-10);c.lineTo(70,-10);c.moveTo(-68,-11);c.lineTo(-58,-11);c.stroke();
    c.strokeStyle='rgba(17,24,30,.6)';c.lineWidth=.8;c.strokeRect(v.style===2?-6:-16,-33,v.style===2?35:42,18);
    c.fillStyle='#a5aaa4';c.fillRect(v.style===2?-1:-9,-29,7,1.5);
    oval(61,-29,v.style===1?5:3.5,4,'#e2c88b');oval(-63,-23,2,3,'#8d2d25');
    if(v.style===0){c.strokeStyle='#343b35';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(43+i*2,-24);c.lineTo(43+i*2,-19);c.stroke();}}
    c.globalAlpha=.10;c.fillStyle='#eac788';c.beginPath();c.moveTo(65,-26);c.lineTo(150,4);c.lineTo(73,2);c.fill();c.restore();
  }
  drawWindows(dt){
    const c=this.ctx;
    for(const w of this.windows){
      w.next-=dt;if(w.next<=0){w.on=!w.on;w.next=12+Math.random()*28;}
      c.fillStyle='#19282c';c.fillRect(w.x,w.y,w.w,w.h);
      if(w.on){const light=c.createLinearGradient(0,w.y,0,w.y+w.h);light.addColorStop(0,w.top);light.addColorStop(1,w.bottom);c.fillStyle=light;c.fillRect(w.x,w.y,w.w,w.h);}
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
    this.cars=this.cars.filter(v=>v.x>-215&&v.x<983);
    for(const v of this.cars){v.x+=v.dir*v.speed*dt;this.drawCar(v,t);}
    this.soft.drawImage(this.canvas,0,0,256,256);
    this.blurCtx.drawImage(this.texture,0,0,64,64);
    return true;
  }
}
