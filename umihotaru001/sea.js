'use strict';
(() => {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha:false});
  const water = document.createElement('canvas');
  const wc = water.getContext('2d', {alpha:false});
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sc = sprite.getContext('2d');
  const glow = sc.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,'rgba(45,118,255,1)');
  glow.addColorStop(.24,'rgba(22,91,255,1)');
  glow.addColorStop(.30,'rgba(10,68,255,.12)');
  glow.addColorStop(.43,'rgba(0,45,255,.035)');
  glow.addColorStop(1,'rgba(0,35,255,0)');
  sc.fillStyle=glow;sc.fillRect(0,0,64,64);
  let w,h,nx,ny,a,b,c,pixels,moonMask,particles=[],scaleX,scaleY;
  let t=0,last=0,acc=0,next=0,paused=false;
  let pointerId=null,contact=null,emitted=null,holdAt=0,pulseSerial=0;
  let pulses=[],contactGlow=null,sparks=[],flames=[],embers=[],flameAt=0;
  const TOUCH_LIFE=2.4;
  // A non-repeating spatial spectrum; the outer green blends into sea blue.
  const spectrum=[[255,227,35],[255,48,30],[163,42,244],[35,91,255],[20,220,138],[36,116,255]];
  const touchPalette=Array.from({length:144},(_,i)=>{
    const u=i/143*5,k=Math.min(4,Math.floor(u)),f=u-k;
    const blend=f*f*(3-2*f);
    return `rgb(${spectrum[k].map((v,j)=>Math.round(v+(spectrum[k+1][j]-v)*blend)).join(',')})`;
  });
  function softSprite(color){
    const image=document.createElement('canvas');image.width=image.height=48;
    const g=image.getContext('2d'),gradient=g.createRadialGradient(24,24,0,24,24,24);
    gradient.addColorStop(0,color);gradient.addColorStop(.25,color);
    gradient.addColorStop(.58,color.replace('rgb(', 'rgba(').replace(')', ',.28)'));
    gradient.addColorStop(1,color.replace('rgb(', 'rgba(').replace(')', ',0)'));
    g.fillStyle=gradient;g.fillRect(0,0,48,48);return image;
  }
  const colorSprites=touchPalette.map(softSprite),whiteSprite=softSprite('rgb(255,255,255)');
  // Cache blur levels so dim particles still require just one sprite draw.
  const blueSprites=Array.from({length:16},(_,i)=>{
    if(i===15)return sprite;
    const softness=1-i/15;
    const image=document.createElement('canvas');image.width=image.height=64;
    const g=image.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
    r.addColorStop(0,'rgba(45,118,255,1)');
    r.addColorStop(.24,`rgba(22,91,255,${1-softness*.25})`);
    r.addColorStop(.30,`rgba(10,68,255,${.12+softness*.46})`);
    r.addColorStop(.43,`rgba(0,45,255,${.035+softness*.285})`);
    r.addColorStop(1,'rgba(0,35,255,0)');
    g.fillStyle=r;g.fillRect(0,0,64,64);return image;
  });
  const blueCore=Array.from({length:64},(_,i)=>{
    const peak=Math.max(0,(i/63-.48)/.52);
    const white=peak*peak;
    return `rgb(${Math.round(36+219*white)},${Math.round(116+139*white)},255)`;
  });
  const rand=(a,b)=>a+Math.random()*(b-a);
  function resize(){
    w=innerWidth;h=innerHeight;
    pulses=[];contactGlow=null;sparks=[];flames=[];embers=[];pointerId=null;contact=null;emitted=null;
    const dpr=Math.min(devicePixelRatio||1,1.65);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const step=Math.max(4.5,Math.sqrt(w*h/42000));
    nx=Math.ceil(w/step);ny=Math.ceil(h/step);
    water.width=nx;water.height=ny;scaleX=w/nx;scaleY=h/ny;
    a=new Float32Array(nx*ny);b=new Float32Array(nx*ny);c=new Float32Array(nx*ny);
    pixels=wc.createImageData(nx,ny);
    moonMask=new Float32Array(nx*ny);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const dx=(x/nx-.64)/.32,dy=(y/ny-.35)/.48;
      moonMask[y*nx+x]=Math.exp(-(dx*dx+dy*dy)*1.6);
    }
    particles=Array.from({length:Math.min(6500,Math.round(w*h/130))},(_,id)=>({
      id,x:rand(2,nx-3),y:rand(2,ny-3),light:0,sensitivity:rand(.025,.11),glowGain:rand(.6,1.6),size:rand(3,6),phase:rand(0,6.28),heading:rand(0,6.28),turn:0,vx:0,vy:0,
      cruise:rand(2.5,8),kick:0,decision:rand(0,2),response:rand(.2,.4),energy:0,touchAt:-100,touchPower:0,whiteUntil:-100,touchX:0,touchY:0,touchRange:1
    }));
    disturb(nx*.43,ny*.55,1.6,5);disturb(nx*.75,ny*.23,1.1,3);
  }
  function disturb(x,y,power,r){
    for(let yy=Math.max(1,Math.floor(y-r*3));yy<Math.min(ny-1,y+r*3);yy++)
      for(let xx=Math.max(1,Math.floor(x-r*3));xx<Math.min(nx-1,x+r*3);xx++){
        const dx=xx-x,dy=yy-y;
        a[yy*nx+xx]+=Math.exp(-(dx*dx+dy*dy)/(r*r))*power;
      }
  }
  function excite(p,power,white=false,source=null){
    const oldDistance=Math.hypot(p.x*scaleX-p.touchX,p.y*scaleY-p.touchY)/p.touchRange;
    const newDistance=source?Math.hypot(p.x*scaleX-source.x,p.y*scaleY-source.y)/source.range:1;
    if(source&&(t-p.touchAt>=TOUCH_LIFE||newDistance<oldDistance||white)){
      p.touchX=source.x;p.touchY=source.y;p.touchRange=source.range;
    }
    p.touchAt=t;p.touchPower=power;
    if(white)p.whiteUntil=t+.055;
  }
  function ignite(x,y,white=false){
    const radius=Math.max(22,Math.min(w,h)*.055);
    const id=++pulseSerial;
    const pulse={x,y,born:t,id,radius,speed:Math.max(95,Math.min(w,h)*.32)*1.8,hit:new Uint8Array(particles.length)};
    pulse.range=radius+(pulse.speed/1.8)*2.5;
    pulses.push(pulse);

    if(pulses.length>24)pulses.shift();
    disturb(x/scaleX,y/scaleY,2.6,Math.max(2,radius/scaleX*.55));
    for(const p of particles){
      const dx=p.x*scaleX-x,dy=p.y*scaleY-y;
      if(dx*dx+dy*dy<radius*radius){excite(p,1,white,pulse);pulse.hit[p.id]=1;}
    }
  }
  function burst(x,y){
    // One energetic, short-lived ignition per press; no fixed dots along a stroke.
    for(let i=0;i<16;i++){
      const angle=rand(0,Math.PI*2),speed=rand(65,230),life=rand(.24,.65);
      sparks.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
        life,total:life,r:rand(.45,1.15)});
    }
    for(let i=0;i<11;i++){
      const angle=rand(0,Math.PI*2),speed=rand(18,65),life=rand(.24,.52);
      flames.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
        life,total:life,size:rand(12,25),seed:rand(0,6.28)});
    }
    sparks=sparks.slice(-96);flames=flames.slice(-66);
  }
  function followFlame(from,to){
    const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy);
    const count=Math.max(1,Math.min(160,Math.ceil(distance/5)));
    const ux=distance?dx/distance:0,uy=distance?dy/distance:0;
    for(let j=1;j<=count;j++){
      const f=j/count,life=rand(.18,.38),side=rand(-2.5,2.5);
      const x=from.x+dx*f-uy*side,y=from.y+dy*f+ux*side;
      flames.push({x,y,vx:-ux*rand(10,32)+rand(-12,12),vy:-uy*rand(10,32)+rand(-12,12),
        life,total:life,size:rand(16,26)+Math.min(10,distance*.035),seed:rand(0,6.28)});
      if(j%6===0&&distance>8){
        const angle=rand(0,Math.PI*2),speed=rand(45,150),sparkLife=rand(.18,.4);
        sparks.push({x,y,vx:Math.cos(angle)*speed+ux*25,vy:Math.sin(angle)*speed+uy*25,
          life:sparkLife,total:sparkLife,r:rand(.45,.95)});
      }
    }
    flames=flames.slice(-480);sparks=sparks.slice(-120);flameAt=t+.04;
  }
  function position(e){
    const r=canvas.getBoundingClientRect();
    return {x:Math.max(0,Math.min(w,(e.clientX-r.left)*w/r.width)),
      y:Math.max(0,Math.min(h,(e.clientY-r.top)*h/r.height))};
  }
  function stroke(to){
    const from=emitted||to,dx=to.x-from.x,dy=to.y-from.y;
    const distance=Math.hypot(dx,dy),spacing=Math.max(12,Math.min(w,h)*.026);
    if(distance<spacing)return;
    const count=Math.min(18,Math.ceil(distance/spacing));
    for(let j=1;j<=count;j++)ignite(from.x+dx*j/count,from.y+dy*j/count,true);
    emitted=to;holdAt=t+.28;
  }
  canvas.addEventListener('pointerdown',e=>{
    if(pointerId!==null||paused||e.button>0)return;
    e.preventDefault();pointerId=e.pointerId;canvas.setPointerCapture(pointerId);
    contact=position(e);contactGlow={...contact,born:t};emitted=contact;burst(contact.x,contact.y);ignite(contact.x,contact.y,true);holdAt=t+.28;render();
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    const from=contact;contact=position(e);
    followFlame(from,contact);contactGlow={...contact,born:t};stroke(contact);
  });
  function release(e){
    if(e.pointerId!==pointerId)return;
    if(e.type==='pointerup'){const to=position(e);if(contact)followFlame(contact,to);stroke(to);}
    pointerId=null;contact=null;emitted=null;
  }
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('lostpointercapture',release);
  document.addEventListener('visibilitychange',()=>{pointerId=null;contact=null;emitted=null;});
  function update(){
    t+=1/60;
    sparks=sparks.filter(p=>p.life>1/60);
    flames=flames.filter(p=>!p.split);
    for(const p of sparks){
      p.life-=1/60;p.vx*=.963;p.vy*=.963;
      p.x+=p.vx/60;p.y+=p.vy/60;
    }
    for(const p of flames){
      p.life-=1/60;
      if(!p.split){
        p.split=true;
        // These same individuals start as a white cluster and then disperse yellow.
        const count=(p.seed<Math.PI?2:3);
        for(let j=0;j<count;j++){
          const angle=p.seed+j*2.399963,radius=2+Math.sqrt(j)*2.2;
          const speed=rand(30,96),life=rand(1.1,1.8);
          embers.push({x:p.x+Math.cos(angle)*radius,y:p.y+Math.sin(angle)*radius,
            vx:p.vx*.35+Math.cos(angle)*speed,vy:p.vy*.35+Math.sin(angle)*speed,
            life,total:life,whiteLife:rand(.045,.085),size:rand(4,7),phase:rand(0,6.28)});
        }
      }
    }
    embers=embers.filter(p=>p.life>1/60).slice(-700);
    for(const p of embers){
      p.life-=1/60;
      p.vx=p.vx*.984+Math.sin(t*2.1+p.phase)*.16;
      p.vy=p.vy*.984+Math.cos(t*1.7+p.phase)*.16;
      const elapsed=p.total-p.life;
      const release=Math.min(1,Math.max(0,(elapsed-p.whiteLife)/.055));
      p.x+=p.vx/60*release;p.y+=p.vy/60*release;
    }
    if(contact&&t>=flameAt)followFlame(contact,contact);
    if(contact&&t>=holdAt){ignite(contact.x,contact.y);holdAt=t+.28;}
    pulses=pulses.filter(q=>t-q.born<2.5);
    if(contactGlow&&!contact&&t-contactGlow.born>.08)contactGlow=null;
    if(t>=next){
      const x=rand(nx*.08,nx*.92),y=rand(ny*.08,ny*.92);
      const r=rand(3.5,7),power=rand(.65,2.1);
      disturb(x,y,power,r);
      // A disturbance is an irregular cluster, never a perfect luminous circle.
      for(let j=0;j<3;j++)disturb(x+rand(-10,10),y+rand(-10,10),power*rand(.15,.5),r*.6);
      next=t+rand(1.8,3.8);
    }
    for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
      const i=y*nx+x;
      c[i]=(2*a[i]-b[i]+.12*(a[i-1]+a[i+1]+a[i-nx]+a[i+nx]-4*a[i]))*.997;
    }
    const old=b;b=a;a=c;c=old;
    // Shared pulse values are computed once per step, not once per particle.
    for(const q of pulses){
      const age=t-q.born;
      q.front=q.radius+age*q.speed;
      q.outer2=(q.front+17)*(q.front+17);
      q.inner2=Math.max(0,q.front-17)**2;
      q.power=Math.max(.55,Math.exp(-age*.4));
    }
    for(const p of particles){
      const i=Math.floor(p.y)*nx+Math.floor(p.x);
      const px=p.x*scaleX,py=p.y*scaleY;
      for(const q of pulses){
        if(q.hit[p.id])continue;
        const dx=px-q.x,dy=py-q.y,d2=dx*dx+dy*dy;
        if(d2>q.outer2)continue;
        let reached=d2<=q.inner2;
        if(!reached){
          const angle=Math.atan2(dy,dx);
          const warp=Math.sin(angle*4+t*1.4)*7+Math.max(-10,Math.min(10,a[i]*8));
          const front=q.front+warp;
          reached=front>=0&&d2<=front*front;
        }
        if(reached){
          excite(p,q.power,false,q);q.hit[p.id]=1;
        }
      }
      const strain=Math.abs(a[i]-b[i])*2.8+Math.abs(a[i+1]-a[i-1])*.42;
      // Slowly shifting pockets are warped by the actual water displacement.
      const patch=.5+.5*Math.sin(p.x*.071-t*.13+Math.sin(p.y*.093+t*.11)*2+a[i]*2.2);
      const cluster=.06+1.75*patch*patch*patch;
      const crest=Math.min(1,Math.abs(a[i+1]+a[i-1]+a[i+nx]+a[i-nx]-4*a[i])*4);
      const excitation=Math.max(0,strain-p.sensitivity)*cluster*p.glowGain*(.65+crest*1.7);
      // Follow local wave energy directly; a short response smooths the pulse,
      // rather than holding the brightest value after every disturbance.
      const response=1-Math.exp(-excitation*14);
      const target=response*response;
      p.light+=(target-p.light)*(target>p.light?p.response:.115);
      p.energy+=(strain-p.energy)*.18;
      // Each animal steers and swims independently, carried by the same water.
      p.decision-=1/60;
      if(p.decision<=0){
        p.turn=rand(-1.9,1.9);
        p.kick=rand(5,19);
        p.decision=rand(.45,2.7);
      }
      p.kick*=.97;
      p.heading+=(p.turn+Math.sin(t*1.7+p.phase)*.55)/60;
      const speed=p.cruise+p.kick+Math.min(9,p.energy*25);
      const flowX=Math.sin(p.y*.045+t*.21)*2.3-(a[i+1]-a[i-1])*14;
      const flowY=Math.cos(p.x*.048+t*.17)*2.3-(a[i+nx]-a[i-nx])*14;
      p.vx+=(Math.cos(p.heading)*speed+flowX-p.vx)*.055;
      p.vy+=(Math.sin(p.heading)*speed+flowY-p.vy)*.055;
      p.x+=p.vx/(60*scaleX);p.y+=p.vy/(60*scaleY);
      if(p.x<2||p.x>nx-3){p.x=Math.max(2,Math.min(nx-3,p.x));p.heading=Math.PI-p.heading;p.vx*=-.5;}
      if(p.y<2||p.y>ny-3){p.y=Math.max(2,Math.min(ny-3,p.y));p.heading=-p.heading;p.vy*=-.5;}
    }
  }
  function render(){
    const data=pixels.data;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const i=y*nx+x,k=i*4;
      const slope=x>0&&x<nx-1?a[i+1]-a[i-1]:0;
      const grain=Math.sin(x*.16+Math.sin(y*.13+t*.15)*2+t*.12)*Math.sin(y*.22-x*.05+t*.1);
      const glint=Math.min(15,Math.abs(slope)*17);
      // Faint moon reflection follows local surface tilt, below all fireflies.
      const slopeY=y>0&&y<ny-1?a[i+nx]-a[i-nx]:0;
      const hx=slope+grain*.045-.10,hy=slopeY-grain*.025+.065;
      let specular=1/(1+hx*hx*180+hy*hy*240);
      specular*=specular;specular*=specular;
      const moon=22*moonMask[i]*specular;
      data[k]=1+glint*.12+moon*.78;
      data[k+1]=5+grain*1.2+glint*.5+moon*.88;
      data[k+2]=9+grain*2+glint+moon;
      data[k+3]=255;
    }
    wc.putImageData(pixels,0,0);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.drawImage(water,0,0,w,h);
    const v=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.12,w*.5,h*.5,Math.hypot(w,h)*.55);
    v.addColorStop(0,'rgba(0,2,5,0)');v.addColorStop(1,'rgba(0,2,5,.64)');
    ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='lighter';
    for(const p of particles){
      const touchAge=(t-p.touchAt)/TOUCH_LIFE;
      const touched=touchAge>=0&&touchAge<1;
      const touchLight=touched?p.touchPower*Math.pow(1-touchAge,1.25):0;
      if(p.light<.016&&touchLight<.01)continue;
      const bright=Math.min(1,p.light/.65);
      const softness=1-bright*bright*(3-2*bright);
      const size=p.size*(.9+p.light*.35)*(1+.4*softness);
      // Color replaces the blue body during ignition, avoiding additive whitening.
      if(touched){
        const px=p.x*scaleX,py=p.y*scaleY;
        const distance=Math.min(1,Math.hypot(px-p.touchX,py-p.touchY)/p.touchRange);
        const recovery=Math.max(0,(touchAge-.7)/.3);
        const tint=distance+(1-distance)*recovery;
        const idx=Math.min(143,Math.floor(tint*143));
        const wave=.85+Math.min(.15,p.energy*.8);
        const nearDiameter=(p.size*1.5+4)*.5*1.4;
        const farDiameter=p.size*.36;
        const shrink=distance*distance*(3-2*distance);
        const diameter=nearDiameter+(farDiameter-nearDiameter)*Math.max(shrink,recovery);
        ctx.globalCompositeOperation='source-over';
        ctx.globalAlpha=Math.min(1,touchLight*2.3)*wave;
        ctx.drawImage(t<p.whiteUntil?whiteSprite:colorSprites[idx],px-diameter/2,py-diameter/2,diameter,diameter);
        ctx.globalCompositeOperation='lighter';
        continue;
      }
      const px=p.x*scaleX,py=p.y*scaleY;
      ctx.globalAlpha=Math.min(1,p.light*1.65);
      ctx.drawImage(blueSprites[Math.round((1-softness)*15)],px-size/2,py-size/2,size,size);
      // Only the strongest wave-driven peaks approach white; faint points stay blue.
      if(p.light>.28){
        ctx.globalAlpha=Math.min(1,(p.light-.28)*1.8);
        ctx.fillStyle=blueCore[Math.min(63,Math.floor(p.light*63))];
        ctx.beginPath();ctx.ellipse(px,py,.3+p.light*.32,.22+p.light*.22,p.heading,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.globalCompositeOperation='source-over';
    // Only the current fingertip glows; interpolated samples leave no dot trail.
    if(contactGlow){
      const q=contactGlow,age=t-q.born;
      const white=age<.055;
      ctx.globalAlpha=contact?1:Math.max(0,1-age/.08);
      const diameter=5;
      ctx.drawImage(white?whiteSprite:colorSprites[0],q.x-diameter/2,q.y-diameter/2,diameter,diameter);
    }
    ctx.globalCompositeOperation='lighter';
    ctx.globalCompositeOperation='source-over';
    for(const p of embers){
      const age=1-p.life/p.total;
      const white=p.total-p.life<p.whiteLife;
      const tint=Math.max(0,(age-.22)/.78);
      const idx=Math.min(143,Math.floor(tint*143));
      const diameter=p.size*(1-age*.4);
      ctx.globalAlpha=Math.min(1,p.life/.35);
      ctx.drawImage(white?whiteSprite:colorSprites[idx],p.x-diameter/2,p.y-diameter/2,diameter,diameter);
    }
    ctx.globalCompositeOperation='lighter';
    for(const p of sparks){
      const color=p.total-p.life<.065?'#ffffff':'#ffe323';
      ctx.strokeStyle=color;ctx.fillStyle=color;
      ctx.globalAlpha=Math.min(1,p.life/.2);
      ctx.lineWidth=p.r;

      ctx.beginPath();ctx.arc(p.x,p.y,p.r*.65,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function frame(now){
    if(!paused&&!document.hidden){
      acc+=Math.min((now-last)/1000,.05);
      while(acc>=1/60){update();acc-=1/60;}
      render();
    }
    last=now;requestAnimationFrame(frame);
  }
  const button=document.querySelector('button');
  button.addEventListener('click',()=>{paused=!paused;if(paused){pointerId=null;contact=null;emitted=null;}button.textContent=paused?'▷':'Ⅱ';button.setAttribute('aria-label',paused?'動きを再開':'動きを一時停止');button.title=paused?'再開':'一時停止';});
  addEventListener('resize',resize);
  resize();
  for(let i=0;i<95;i++)update();
  render();requestAnimationFrame(frame);
})();
