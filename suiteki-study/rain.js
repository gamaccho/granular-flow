/* A small, bounded rain simulation; distances use the viewport's short side. */
class RainGlass {
  constructor(random=Math.random){this.random=random;this.drops=[];this.spray=[];this.merges=[];this.w=1;this.h=1;this.next=.3;this.fallRadius=.105*1.4*.8;this.rainRadius=.025;this.fallSpeed=1.1;this.events={born:0,merged:0,fallen:0,splashes:0};}
  bounds(w,h){this.w=w;this.h=h;}
  stretch(d){return 1+Math.min(4.2,Math.max(0,-d.vy)*this.fallSpeed*3.0);}
  verticalScale(d,above){const tail=this.stretch(d);return above?tail:1+(tail-1)*.18;}
  canPlace(x,y,r){
    // Include the whole new bead, the existing surface and the upward tail.
    return this.drops.every(d=>{
      const sy=this.verticalScale(d,y>d.y);
      return Math.hypot(x-d.x,(y-d.y)/sy)>=(d.r+r)*.80;
    });
  }
  add(x,y,r){
    if(this.drops.length>=24||!this.canPlace(x,y,r))return null;
    const d={x,y,r,vx:0,vy:0,falling:false,exitSplash:false,merge:null};this.drops.push(d);this.events.born++;return d;
  }
  spawnRain(){
    const r=this.rainRadius;
    for(let attempt=0;attempt<32;attempt++){
      const anchor=this.drops.length&&(this.drops.length>=18||this.random()<.65)?this.drops[Math.floor(this.random()*this.drops.length)]:null;
      const angle=this.random()*Math.PI*2;
      const distance=anchor?(anchor.r+r)*(.81+this.random()*.06):0;
      const x=anchor?anchor.x+Math.cos(angle)*distance:(this.random()-.5)*this.w*.94;
      const y=anchor?anchor.y+Math.sin(angle)*distance:(this.random()-.5)*this.h*.94;
      if(Math.abs(x)>this.w/2-r*.6||Math.abs(y)>this.h/2-r*.6)continue;
      if(this.add(x,y,r))return;
    }
  }
  reset(){this.drops.length=0;this.spray.length=0;this.merges.length=0;this.next=.3;for(let i=0;i<13;i++)this.add((this.random()-.5)*this.w*.85,(this.random()-.5)*this.h*.76,this.rainRadius);}
  splash(x,y,exit=false){this.events.splashes++;for(let i=0;i<5;i++){if(this.spray.length>=45)this.spray.shift();this.spray.push({x,y,vx:(this.random()-.5)*.40,vy:(exit?.16:.03)+this.random()*.23,r:.0025+this.random()*.0035,life:.35+this.random()*.4});}}
  step(dt,held,target){
    this.next-=dt;
    if(this.next<=0){
      this.next=.24+this.random()*.55;
      this.spawnRain();
    }
    for(let i=this.merges.length-1;i>=0;i--){
      const m=this.merges[i],a=m.a,b=m.b;m.t=Math.min(1,m.t+dt/.31);
      const e=m.t*m.t*(3-2*m.t);
      if(held===a||held===b){held=a;m.vx+=(target.x-m.x)*dt*110;m.vy+=(target.y-m.y)*dt*110;m.vx*=Math.exp(-16*dt);m.vy*=Math.exp(-16*dt);}
      else if(a.falling||b.falling){m.vy-=dt*1.1;}
      m.x+=m.vx*dt;m.y+=m.vy*dt*((a.falling||b.falling)&&held!==a&&held!==b?this.fallSpeed:1);
      a.x=m.x+m.ax*(1-e);a.y=m.y+m.ay*(1-e);b.x=m.x+m.bx*(1-e);b.y=m.y+m.by*(1-e);
      a.r=Math.sqrt(m.aa+m.bb*e);b.r=Math.sqrt(m.bb*(1-e));
      a.vx=b.vx=m.vx;a.vy=b.vy=m.vy;
      if(m.t===1){a.merge=null;a.falling=a.falling||b.falling;this.drops.splice(this.drops.indexOf(b),1);this.merges.splice(i,1);this.events.merged++;}
    }
    for(const d of this.drops){
      if(d.merge)continue;
      if(d!==held&&!d.falling&&d.r>=this.fallRadius){d.falling=true;d.vy=-.04;this.splash(d.x,d.y);}
      if(d===held){d.vx+=(target.x-d.x)*dt*110;d.vy+=(target.y-d.y)*dt*110;d.vx*=Math.exp(-dt*16);d.vy*=Math.exp(-dt*16);}
      else if(d.falling){d.vy-=dt*(.8+d.r*5);d.vy*=Math.exp(-dt*.65);d.vx*=Math.exp(-dt*5);}
      else {d.vx*=Math.exp(-dt*14);d.vy*=Math.exp(-dt*14);}
      d.x+=d.vx*dt;d.y+=d.vy*dt*(d.falling&&d!==held?this.fallSpeed:1);
      d.x=Math.max(-this.w/2+d.r*.4,Math.min(this.w/2-d.r*.4,d.x));
      if(!d.falling||d===held)d.y=Math.max(-this.h/2+d.r*.5,Math.min(this.h/2-d.r*.5,d.y));
      if(d.falling&&!d.exitSplash&&d.y<-this.h/2+d.r*.5){d.exitSplash=true;this.splash(d.x,-this.h/2+.012,true);}
    }
    for(let i=0;i<this.drops.length;i++)for(let j=this.drops.length-1;j>i;j--){
      const a=this.drops[i],b=this.drops[j];if(a.merge||b.merge)continue;
      const dx=b.x-a.x,dy=b.y-a.y;
      const stretch=Math.max(this.verticalScale(a,dy>0),this.verticalScale(b,dy<0));
      const distance=Math.hypot(dx,dy/stretch),sum=a.r+b.r;
      if(distance<sum*.95&&distance>sum*.76){
        const pull=dt*.018;const len=Math.hypot(dx,dy)||1;
        if(a!==held){a.x+=dx/len*pull;a.y+=dy/len*pull;}
        if(b!==held){b.x-=dx/len*pull;b.y-=dy/len*pull;}
      }
      if(distance<=sum*.76){
        const aa=a.r*a.r,bb=b.r*b.r,area=aa+bb;
        const x=(a.x*aa+b.x*bb)/area,y=(a.y*aa+b.y*bb)/area;
        const m={a,b,aa,bb,x,y,ax:a.x-x,ay:a.y-y,bx:b.x-x,by:b.y-y,vx:(a.vx*aa+b.vx*bb)/area,vy:(a.vy*aa+b.vy*bb)/area,t:0};
        a.merge=b.merge=m;this.merges.push(m);if(held===b)held=a;
      }
    }
    for(let i=this.drops.length-1;i>=0;i--){const d=this.drops[i];if(!d.merge&&d!==held&&d.y<-this.h/2-d.r*(this.stretch(d)*.7+.3)){this.drops.splice(i,1);this.events.fallen++;}}
    for(let i=this.spray.length-1;i>=0;i--){const s=this.spray[i];s.life-=dt;s.vy-=dt*.8;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.life<=0)this.spray.splice(i,1);}
    return held;
  }
}
if(typeof module!=='undefined')module.exports=RainGlass;
