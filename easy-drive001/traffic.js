/* Artwork signal timings and driving dynamics (not a real traffic controller). */
(function(root){
'use strict';
const DRIVING={maxSpeed:720,localSpeed:390,acceleration:360,braking:650,planningBrake:390};
function approachLayout(e,crossings,minimum){
 const lengths=e.p.slice(1).map((b,i)=>Math.hypot(b[0]-e.p[i][0],b[1]-e.p[i][1])),total=lengths.reduce((a,b)=>a+b,0);let clearance=minimum,offset=0,crossingIds=[];
 for(let i=1;i<e.p.length;i++){const a=e.p[i-1],b=e.p[i],dx=b[0]-a[0],dy=b[1]-a[1],len=lengths[i-1];if(!len)continue;
  if(total-offset-len<220)for(const f of crossings)for(let j=1;j<f.p.length;j++){const c=f.p[j-1],d=f.p[j],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<.001)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;if(t<0||t>1||u<0||u>1)continue;const remaining=total-offset-len*t;if(remaining>180)continue;const sine=Math.abs(den)/(len*Math.hypot(ex,ey)),nearEdge=remaining+f.w/(2*Math.max(.2,sine));clearance=Math.max(clearance,nearEdge+9);crossingIds.push(f.id);}
  offset+=len;
 }
 // Walk back along the actual approach polyline, including bends.
 let d=clearance;for(let i=e.p.length-1;i>0;i--){const a=e.p[i-1],b=e.p[i],len=lengths[i-1];if(d<=len||i===1){const ux=(b[0]-a[0])/(len||1),uy=(b[1]-a[1])/(len||1);return {clearance:Math.min(clearance,total),x:b[0]-ux*Math.min(d,len),y:b[1]-uy*Math.min(d,len),ux,uy,crossingIds};}d-=len;}
}
function extendedApproach(map,e){
 let p=e.p.slice(),node=e.a,seen=new Set([e.b,e.a]),length=0;
 while(length<260){const dx=p[1][0]-p[0][0],dy=p[1][1]-p[0][1];let best=null,score=.55;
  for(const prev of map.edges){if(prev.b!==node||seen.has(prev.a)||Math.abs(prev.w-e.w)>12)continue;const q=prev.p.at(-2),r=prev.p.at(-1),dot=((r[0]-q[0])*dx+(r[1]-q[1])*dy)/(Math.hypot(r[0]-q[0],r[1]-q[1])*Math.hypot(dx,dy));if(dot>score){score=dot;best=prev;}}
  if(!best)break;p=best.p.slice(0,-1).concat(p);length+=best.l;node=best.a;seen.add(node);
 }return {...e,p};
}
function clearStop(layout,e,crossings,minimum){
 let result=layout;
 for(let retreat=0;retreat<=180;retreat+=2){
  result=approachLayout(e,crossings,Math.max(minimum,layout.clearance+retreat));let overlap=false;
  for(const f of crossings)for(let j=1;j<f.p.length;j++){const a=f.p[j-1],b=f.p[j],dx=b[0]-a[0],dy=b[1]-a[1];
   for(let k=0;k<=12;k++){const offset=2+(e.w*.5-4)*k/12,x=result.x+result.uy*offset,y=result.y-result.ux*offset,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<f.w/2+4)overlap=true;}
  }if(!overlap)return result;
 }return result;
}
class TrafficSignals {
 constructor(map){this.map=map;this.approaches=new Map();this.junctions=[];const incoming=map.nodes.map(()=>[]),neighbors=map.nodes.map(()=>new Set());map.edges.forEach((e,i)=>{incoming[e.b].push(i);neighbors[e.a].add(e.b);neighbors[e.b].add(e.a);});const candidates=incoming.map((es,node)=>({node,es,w:Math.max(0,...es.map(i=>map.edges[i].w))})).filter(c=>neighbors[c.node].size>=3&&c.w>=39).sort((a,b)=>b.w-a.w||a.node-b.node);
  for(const c of candidates){const p=map.nodes[c.node];if(this.junctions.some(j=>Math.hypot(j.p[0]-p[0],j.p[1]-p[1])<240))continue;const widest=map.edges[c.es.reduce((a,b)=>map.edges[a].w>=map.edges[b].w?a:b)],wa=widest.p.at(-2),wb=widest.p.at(-1),axis=Math.atan2(wb[1]-wa[1],wb[0]-wa[0]),junction={node:c.node,p,axis,offset:(c.node*2.731)%14};this.junctions.push(junction);
   for(const edge of c.es){const e=map.edges[edge],a=e.p.at(-2),b=e.p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,heading=Math.atan2(dy,dx),group=Math.abs(Math.cos(heading-axis))>.707?0:1,extended=extendedApproach(map,e),layout=clearStop(approachLayout(extended,map.crossings||[],c.w*.5+10),extended,map.crossings||[],c.w*.5+10),{clearance,x,y}=layout,nx=layout.uy,ny=-layout.ux;this.approaches.set(edge,{edge,node:c.node,junction,group,clearance,stopPoint:[x,y],crossingIds:layout.crossingIds,x:x+layout.ux*8+nx*Math.min(7,e.w*.18),y:y+layout.uy*8+ny*Math.min(7,e.w*.18),angle:Math.atan2(layout.uy,layout.ux)+Math.PI/2,line:[[x+nx*2,y+ny*2],[x+nx*(e.w*.5-2),y+ny*(e.w*.5-2)]]});}
  }
 }
 phase(approach,time){const t=((time+approach.junction.offset+approach.group*7)%14+14)%14;return t<5?'green':t<6?'yellow':'red';}
 greenRemaining(approach,time){const t=((time+approach.junction.offset+approach.group*7)%14+14)%14;return t<5?5-t:0;}
}
class DriveMotion {
 constructor(route,signals){this.route=route;this.signals=signals;this.s=route.startS||0;this.speed=90;this.acceleration=0;this.time=0;this.stoppedSeconds=0;this.passedSignals=0;this.lastSignal=null;}
 step(dt){if(dt<=0)return;this.route.ensure(this.s);this.time+=dt;let target=this.route.target(this.s),stop=null;for(const event of this.route.stops){if(event.s<this.s-.01)continue;if(event.s-this.s>1100)break;const d=Math.max(0,event.s-this.s),color=this.signals.phase(event.approach,this.time);
   const arrival=d/Math.max(this.speed,120),willChange=color==='green'&&arrival+.65>this.signals.greenRemaining(event.approach,this.time);
   if(color!=='green'||willChange){target=Math.min(target,Math.sqrt(2*300*Math.max(0,d-this.speed*.4)),d*2);stop=event;break;}
  }
  const desired=Math.max(-DRIVING.braking,Math.min(DRIVING.acceleration,(target-this.speed)*5));this.acceleration+=(desired-this.acceleration)*(1-Math.exp(-dt*12));this.speed=Math.max(0,Math.min(DRIVING.maxSpeed,this.speed+this.acceleration*dt));let next=this.s+this.speed*dt;
  // A changing phase can never carry the car through a red stop line, even at low FPS.
  for(const event of this.route.stops){if(event.s<this.s-.01)continue;if(event.s>next+.001)break;if(this.signals.phase(event.approach,this.time)==='red'||(stop===event&&target<1)){next=Math.min(next,event.s);this.speed=0;this.acceleration=0;this.lastSignal=event.approach.node;break;}if(next>event.s+.001)this.passedSignals++;}
  if(stop&&stop.s-this.s<.25&&target<1){next=stop.s;this.speed=0;this.acceleration=0;this.lastSignal=stop.approach.node;}
  this.s=next;if(this.speed<1)this.stoppedSeconds+=dt;
 }
}
root.approachLayout=approachLayout;root.TrafficSignals=TrafficSignals;root.DriveMotion=DriveMotion;root.DRIVING=DRIVING;
})(typeof module!=='undefined'?module.exports:window);
