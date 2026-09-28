/* EASY DRIVE: real OSM town, bounded randomized route, batched WebGL tiles. */
(() => {
'use strict';
const canvas=document.getElementById('scene'),speedDigits=[...document.querySelectorAll('.seven-seg g')].map(g=>[...g.children]),gaugeFill=document.getElementById('gauge-fill'),gaugeNeedle=document.getElementById('gauge-needle');
const gl=canvas.getContext('webgl',{alpha:false,stencil:true,antialias:true,powerPreference:'low-power'});
if(!gl){document.getElementById('fallback').style.display='grid';return;}
const C={grass:'#64b77a',park:'#42b67a',tree:'#12815a',treeLight:'#36c77b',treeDark:'#086548',trunk:'#456353',land:'#bacbd6',walk:'#a4bac7',curb:'#73858a',road:'#3d5361',line:'#eef5ef',shadow:'#879394',cream:'#f2f5f1',peach:'#a5afb1',blue:'#889598',yellow:'#f3bd45',roof:'#aeb7b9',concrete:'#929ea2',concreteDark:'#808d92',roofLight:'#d3dcdb',roofEdge:'#63757c',recess:'#51666f',dark:'#334850',red:'#f24832',glass:'#143744',water:'#169fbe',signalBody:'#213847',signalGreen:'#22ed83',signalYellow:'#ffcb35',signalRed:'#ff4c42',signalOff:'#52616b',windowWarm:'#ffd38a',windowCool:'#b7e4ee',headlamp:'#fff5ce',tailLamp:'#ff4027',trainGreen:'#85d339',trainRoof:'#c7d3d8',bridgeDeck:'#7eacb5',bridgeRail:'#d1e5e8',crow:'#14232c',cloud:'#f6fbff'};
const colors={};for(const [k,v] of Object.entries(C))colors[k]=[1,3,5].map(n=>parseInt(v.slice(n,n+2),16)/255);
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec3 c;uniform vec2 camera;uniform vec2 view;uniform float angle;varying vec3 color;varying vec2 location;void main(){float s=sin(angle),t=cos(angle);vec2 q=vec2(p.x*t-p.y*s,p.x*s+p.y*t)-camera;gl_Position=vec4(q.x/view.x,-q.y/view.y,0.,1.);color=c;location=q;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
 varying vec3 color;varying vec2 location;
 uniform vec3 ambient;uniform float night;uniform float emission;uniform float opacity;uniform vec2 forward;
 float beam(float side,float distance,float origin){if(distance<=0.||distance>=170.)return 0.;float width=3.+distance*.17;float edge=1.-smoothstep(width*.35,width,abs(side-origin));float fade=1.-smoothstep(32.,170.,distance);return edge*fade*smoothstep(0.,8.,distance);}
 void main(){float d=dot(location,forward)-12.;float side=dot(location,vec2(-forward.y,forward.x));float light=clamp(beam(side,d,-4.5)+beam(side,d,4.5),0.,1.3)*night;
 vec3 lit=color*ambient+light*(color*vec3(.82,.77,.6)+vec3(.028,.024,.013));gl_FragColor=vec4(mix(lit,color,emission),opacity);}`));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const pos=gl.getAttribLocation(program,'p'),col=gl.getAttribLocation(program,'c'),camera=gl.getUniformLocation(program,'camera'),view=gl.getUniformLocation(program,'view'),angle=gl.getUniformLocation(program,'angle');
gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(col);
const ambientUniform=gl.getUniformLocation(program,'ambient'),nightUniform=gl.getUniformLocation(program,'night'),emissionUniform=gl.getUniformLocation(program,'emission'),opacityUniform=gl.getUniformLocation(program,'opacity'),forwardUniform=gl.getUniformLocation(program,'forward');
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform3f(ambientUniform,1,1,1);gl.uniform1f(opacityUniform,1);gl.uniform1f(emissionUniform,0);
let vertices=[];
function vertex(x,y,c){vertices.push(x,y,...colors[c]);}
function tri(a,b,c,color){vertex(...a,color);vertex(...b,color);vertex(...c,color);}
function rect(x,y,w,h,c){tri([x,y],[x+w,y],[x,y+h],c);tri([x+w,y],[x+w,y+h],[x,y+h],c);}
function circle(x,y,r,c,n=18){for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;tri([x,y],[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(b)*r,y+Math.sin(b)*r],c);}}
function roundRect(x,y,w,h,r,c){rect(x+r,y,w-2*r,h,c);rect(x,y+r,w,h-2*r,c);for(const [a,b] of [[x+r,y+r],[x+w-r,y+r],[x+r,y+h-r],[x+w-r,y+h-r]])circle(a,b,r,c,16);}
function stroke(points,width,c){const sides=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return [[p[0]-dy/len*width/2,p[1]+dx/len*width/2],[p[0]+dy/len*width/2,p[1]-dx/len*width/2]];});for(let i=1;i<sides.length;i++){const a=sides[i-1],b=sides[i];tri(a[0],a[1],b[0],c);tri(a[1],b[1],b[0],c);}}
function upload(){const data=new Float32Array(vertices),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return {buffer,count:data.length/5};}
function draw(mesh,x,y,rotation=0){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,20,0);gl.vertexAttribPointer(col,3,gl.FLOAT,false,20,8);gl.uniform2f(camera,x,y);gl.uniform1f(angle,rotation);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
function hash(x,y,s=0){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s+13,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
const chunks=new Map();let layer=0;
function storeShape(){if(!vertices.length)return;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(let i=0;i<vertices.length;i+=5){minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);}const key=layer+':'+Math.floor((minX+maxX)/1400)+':'+Math.floor((minY+maxY)/1400);let bucket=chunks.get(key);if(!bucket){bucket={layer,data:[],bounds:[minX,minY,maxX,maxY]};chunks.set(key,bucket);}for(const v of vertices)bucket.data.push(v);bucket.bounds=[Math.min(bucket.bounds[0],minX),Math.min(bucket.bounds[1],minY),Math.max(bucket.bounds[2],maxX),Math.max(bucket.bounds[3],maxY)];vertices=[];}
function polygon(f,color,dx=0,dy=0){for(let i=0;i<f.t.length;i+=3)tri([f.t[i][0]+dx,f.t[i][1]+dy],[f.t[i+1][0]+dx,f.t[i+1][1]+dy],[f.t[i+2][0]+dx,f.t[i+2][1]+dy],color);}
function buildingRelief(f){
 const height=3+hash(f.id,11)*5;polygon(f,'shadow',height,height*1.35);polygon(f,['concrete','concreteDark','roof'][Math.floor(hash(f.id,9)*3)]);
 // Roof parapets: a lit north-west rim and a shaded south-east rim, inside the footprint.
 const p=f.p,area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=area>0?1:-1;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*sign*1.8,ny=dx/l*sign*1.8,c=nx+ny>0?'roofLight':'roofEdge';tri(a,b,[a[0]+nx,a[1]+ny],c);tri(b,[b[0]+nx,b[1]+ny],[a[0]+nx,a[1]+ny],c);}
 // Raised service housing and a recessed panel fit within an inscribed footprint triangle.
 let best=null,bestR=0;for(let i=0;i<f.t.length;i+=3){const a=f.t[i],b=f.t[i+1],c=f.t[i+2],la=Math.hypot(b[0]-c[0],b[1]-c[1]),lb=Math.hypot(a[0]-c[0],a[1]-c[1]),lc=Math.hypot(a[0]-b[0],a[1]-b[1]),per=la+lb+lc,r=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/(per||1);if(r>bestR){bestR=r;best=[(a[0]*la+b[0]*lb+c[0]*lc)/per,(a[1]*la+b[1]*lb+c[1]*lc)/per];}}
 if(bestR>7){const angle=roofAngle(f.p),w=Math.min(28,bestR*1.05),h=Math.min(20,bestR*.65),x=-w/2,y=-h/2;
  const roofRect=(rx,ry,rw,rh,color,dx=0,dy=0)=>{const points=[[rx,ry],[rx+rw,ry],[rx+rw,ry+rh],[rx,ry+rh]].map(p=>{const q=roofPoint(best,angle,...p);return [q[0]+dx,q[1]+dy];});tri(points[0],points[1],points[2],color);tri(points[0],points[2],points[3],color);};
  roofRect(x,y,w,h,'roofEdge',2,3);roofRect(x,y,w,h,'roofLight');roofRect(x+2,y+2,w-4,Math.max(2,h-5),'roof');roofRect(x+w*.25,y+h*.3,w*.46,Math.max(2,h*.23),'recess');}

}
function buildingLights(f){
 if(hash(f.id,51)<.18)return;const p=f.p,area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=area>0?1:-1;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<13)continue;const ux=dx/len,uy=dy/len,nx=-uy*sign,ny=ux*sign,spacing=Math.max(10,len/16);
  for(let d=6,k=0;d<len-6;d+=spacing,k++){if(hash(f.id,i,k+70)<.32)continue;const x=a[0]+ux*d+nx*2.8,y=a[1]+uy*d+ny*2.8,w=Math.min(4.5,spacing*.4),h=2.2,c=hash(f.id,i,k+99)<.18?'windowCool':'windowWarm';const q=[[x,y],[x+ux*w,y+uy*w],[x+ux*w+nx*h,y+uy*w+ny*h],[x+nx*h,y+ny*h]];tri(q[0],q[1],q[2],c);tri(q[0],q[2],q[3],c);}
 }
}
function inPolygon(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])hit=!hit;}return hit;}
function tree(x,y,r){circle(x+2,y+3,r,'shadow',10);circle(x,y,r,'tree',12);circle(x-r*.25,y-r*.25,r*.64,'treeLight',10);}
let cloudField,lastSpeed=-1;const digitSegments=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
let clearance,crows=[],treeCount=0,rejectedTrees=0,natureMesh={buffer:gl.createBuffer(),count:0};
let signals,motion,trains,trainMesh={buffer:gl.createBuffer(),count:0},signalMesh={buffer:gl.createBuffer(),count:0};
let heading={angle:0,velocity:0};
let meshes=[],car,carLamps,map,route,s=0,speed=90,acceleration=0,position={x:0,y:0,angle:0},elapsed=0,frames=0,last=0,paused=false,width=innerWidth,height=innerHeight,scale=1,ready=false,drawCalls=0;
const label=document.getElementById('district'),roadLabel=document.getElementById('road-name'),fallback=document.getElementById('fallback');
function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);scale=Math.min(width,height)/400;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(view,width/scale/2,height/scale/2);}addEventListener('resize',resize);resize();
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;fallback.textContent='描画が中断されました。ページを再読み込みしてください。';fallback.style.display='grid';});
function crossingShape(f){const len=cityPathLength(f.p);for(let d=1;d<len-1;d+=5){const p=cityAlong(f.p,d),q=cityAlong(f.p,Math.min(len,d+2.5));stroke([[p.x,p.y],[q.x,q.y]],f.w,'line');}}
function bridgeShape(f){stroke(f.p,f.w+4,'roofEdge');stroke(f.p,f.w,'bridgeRail');stroke(f.p,f.w-3,'bridgeDeck');if(f.steps){const len=cityPathLength(f.p);for(let d=2;d<len;d+=3){const p=cityAlong(f.p,d),nx=Math.cos(p.angle),ny=Math.sin(p.angle);stroke([[p.x-nx*(f.w-3)/2,p.y-ny*(f.w-3)/2],[p.x+nx*(f.w-3)/2,p.y+ny*(f.w-3)/2]],.8,'bridgeRail');}}}
async function build(data){map=data;clearance=new RoadClearance(map.roads);cloudField=new DriftingClouds(map.nodes);signals=new TrafficSignals(map);trains=new CityTrains(map.trainTracks||[]);let count=0;
 for(const f of map.features){vertices=[];
  if(f.k==='building'){layer=1;buildingRelief(f);}
  else if(f.k==='green'||f.k==='water'){layer=0;polygon(f,f.k==='water'?'water':'park');}
  else if(f.k==='rail'){layer=f.elevated?6:2;stroke(f.p,f.elevated?13:9,'roofEdge');stroke(f.p,6,'walk');stroke(f.p,3,'curb');}
  storeShape();
  if(f.k==='building'){layer=5;buildingLights(f);storeShape();}
  if(f.k==='green'){layer=4.2;const xs=f.p.map(p=>p[0]),ys=f.p.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);let t=0;for(let x=x0+14;x<x1;x+=42)for(let y=y0+14;y<y1;y+=42){if(t++>4000)break;const tx=x+(hash(Math.round(x),Math.round(y),2)-.5)*23,ty=y+(hash(Math.round(x),Math.round(y),3)-.5)*23;if(inPolygon(tx,ty,f.p)&&hash(Math.round(x),Math.round(y),8)<.54){const radius=9+hash(Math.round(x),Math.round(y),5)*5;if(clearance.clear(tx,ty,radius+4)){tree(tx,ty,radius);treeCount++;if(hash(Math.round(x),Math.round(y),19)<.09&&[0,1,2,3,4,5,6,7].every(i=>inPolygon(tx+Math.cos(i*Math.PI/4)*25,ty+Math.sin(i*Math.PI/4)*25,f.p)))crows.push({x:tx,y:ty,phase:hash(Math.round(x),Math.round(y),21)*6.28});}else rejectedTrees++;}}storeShape();}
  if(++count%500===0)await new Promise(requestAnimationFrame);
 }
 // Layer the entire road network consistently, including all junction overlaps.
 for(const [pass,color,extra] of [[2,'walk',8],[3,'road',0]]){layer=pass;for(const r of map.roads){stroke(r.p,r.w+extra,color);circle(...r.p[0],(r.w+extra)/2,color,10);circle(...r.p[r.p.length-1],(r.w+extra)/2,color,10);storeShape();}}
 layer=4;for(const r of map.roads){if(r.w<30)continue;let offset=0;for(let k=1;k<r.p.length;k++){const a=r.p[k-1],b=r.p[k],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);for(let d=(24-offset%24)%24;d<len-4;d+=24){const end=Math.min(len,d+8);stroke([[a[0]+dx*d/len,a[1]+dy*d/len],[a[0]+dx*end/len,a[1]+dy*end/len]],1.4,'line');}offset+=len;}storeShape();}
 layer=4;for(const approach of signals.approaches.values()){stroke(approach.line,2.2,'line');storeShape();}
 // The scramble is one broad paved junction, rather than narrow overlapping road strips.
 const scramble=(map.crossings||[]).filter(f=>f.scramble).flatMap(f=>f.p).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(scramble.length>2){const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=points=>{const h=[];for(const p of points){while(h.length>1&&turn(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;},hull=half(scramble).slice(0,-1).concat(half([...scramble].reverse()).slice(0,-1));layer=3;for(let i=1;i<hull.length-1;i++)tri(hull[0],hull[i],hull[i+1],'road');storeShape();}
 layer=4.1;for(const f of map.crossings||[]){crossingShape(f);storeShape();}
 for(const f of map.footbridges||[]){layer=4;stroke(f.p.map(p=>[p[0]+5,p[1]+7]),f.w+5,'shadow');storeShape();layer=8;bridgeShape(f);storeShape();}
 for(const bucket of chunks.values()){vertices=bucket.data;meshes.push({...upload(),layer:bucket.layer,bounds:bucket.bounds});bucket.data=null;}chunks.clear();meshes.sort((a,b)=>a.layer-b.layer);vertices=[];
 // Small car, sized to the local streets, pointing north in local coordinates.
 roundRect(-6,-12,14,28,4,'dark');roundRect(-7.5,-8,3,6,1,'glass');roundRect(4.5,-8,3,6,1,'glass');roundRect(-7.5,6,3,6,1,'glass');roundRect(4.5,6,3,6,1,'glass');roundRect(-6.5,-15,13,29,4,'red');roundRect(-5.5,-6,11,15,2,'glass');roundRect(-4.5,-2,9,7,2,'peach');rect(-5,-12,3,2,'cream');rect(2,-12,3,2,'cream');rect(-5,11,3,2,'yellow');rect(2,11,3,2,'yellow');car=upload();vertices=[];
 rect(-5,-12,3,2,'headlamp');rect(2,-12,3,2,'headlamp');rect(-5,11,3,2,'tailLamp');rect(2,11,3,2,'tailLamp');carLamps=upload();vertices=[];
 route=new DriveRoute(map,Math.random,signals);motion=new DriveMotion(route,signals);s=motion.s;position=route.sample(s);heading={angle:position.angle,velocity:0};ready=true;fallback.style.display='none';document.getElementById('place').hidden=false;requestAnimationFrame(frame);
}
function update(dt){motion.step(dt);elapsed=motion.time;s=motion.s;speed=motion.speed;acceleration=motion.acceleration;position=route.sample(s);heading=easeHeading(heading,position.angle,dt);position.angle=heading.angle;}
function drawSignals(rx,ry){vertices=[];for(const a of signals.approaches.values()){if(Math.abs(a.x-position.x)>rx+25||Math.abs(a.y-position.y)>ry+25)continue;const start=vertices.length;roundRect(-12,-5,24,10,4,'signalBody');const phase=signals.phase(a,elapsed);circle(-7,0,2.65,phase==='green'?'signalGreen':'signalOff',12);circle(0,0,2.65,phase==='yellow'?'signalYellow':'signalOff',12);circle(7,0,2.65,phase==='red'?'signalRed':'signalOff',12);const c=Math.cos(a.angle),sn=Math.sin(a.angle);for(let i=start;i<vertices.length;i+=5){const x=vertices[i],y=vertices[i+1];vertices[i]=a.x+x*c-y*sn;vertices[i+1]=a.y+x*sn+y*c;}}
 gl.bindBuffer(gl.ARRAY_BUFFER,signalMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);signalMesh.count=vertices.length/5;draw(signalMesh,position.x,position.y);vertices=[];
}

function drawTrains(elevated,rx,ry){vertices=[];for(const t of trains.cars(elapsed)){if(t.elevated!==elevated||Math.abs(t.x-position.x)>rx+55||Math.abs(t.y-position.y)>ry+55)continue;const start=vertices.length;
 roundRect(-6,-23,12,46,2.5,'dark');roundRect(-5.5,-22,11,44,2,'trainGreen');rect(-3.8,-19,7.6,38,'trainRoof');rect(-3,-10,6,8,'roofEdge');rect(-3,5,6,8,'roofEdge');for(let y=-16;y<20;y+=9){rect(-5.5,y,1.5,5,'glass');rect(4,y,1.5,5,'glass');}if(t.car===0){rect(-4,-21,8,3,'glass');rect(-4,-23,2,1.5,'headlamp');rect(2,-23,2,1.5,'headlamp');}
 const c=Math.cos(t.angle),sn=Math.sin(t.angle);for(let i=start;i<vertices.length;i+=5){const x=vertices[i],y=vertices[i+1];vertices[i]=t.x+x*c-y*sn;vertices[i+1]=t.y+x*sn+y*c;}}
 gl.bindBuffer(gl.ARRAY_BUFFER,trainMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);trainMesh.count=vertices.length/5;draw(trainMesh,position.x,position.y);vertices=[];
}
function drawNature(rx,ry,lighting){vertices=[];
 for(const b of crows){const a=elapsed*.55+b.phase,x=b.x+Math.cos(a)*22,y=b.y+Math.sin(a)*16;if(Math.abs(x-position.x)>rx+25||Math.abs(y-position.y)>ry+25)continue;const flap=Math.sin(elapsed*8+b.phase),turn=a+Math.PI/2,c=Math.cos(turn),sn=Math.sin(turn),pt=(u,v)=>[x+u*c-v*sn,y+u*sn+v*c];tri(pt(0,-4),pt(-1.8,3),pt(1.8,3),'crow');tri(pt(-1,0),pt(-9,flap*4+1),pt(-4,4),'crow');tri(pt(1,0),pt(9,flap*4+1),pt(4,4),'crow');}
 gl.uniform1f(nightUniform,0);gl.uniform1f(emissionUniform,.3);gl.bindBuffer(gl.ARRAY_BUFFER,natureMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);natureMesh.count=vertices.length/5;draw(natureMesh,position.x,position.y);
 // One airy cloud passage per daytime period, with soft temporal entry and exit.
 const t=lighting.cycleTime,u=(t-5)/15;if(u>0&&u<1){vertices=[];for(const [cx,cy] of cloudField.positions(elapsed)){if(Math.abs(cx-position.x)>rx+140||Math.abs(cy-position.y)>ry+65)continue;for(let i=0;i<64;i++){const point=k=>{const a=k*Math.PI*2/64,r=1+.1*Math.sin(a*5)+.06*Math.cos(a*7);return [cx+Math.cos(a)*110*r,cy+Math.sin(a)*48*r];};tri([cx,cy],point(i),point(i+1),'cloud');}}gl.uniform1f(emissionUniform,1);gl.uniform1f(opacityUniform,.22*Math.pow(Math.sin(u*Math.PI),2));gl.bindBuffer(gl.ARRAY_BUFFER,natureMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);natureMesh.count=vertices.length/5;draw(natureMesh,position.x,position.y);}

 gl.uniform1f(opacityUniform,1);gl.uniform1f(nightUniform,lighting.night);
}
function frame(time){const dt=last?Math.min((time-last)/1000,.04):0;last=time;if(!paused&&!document.hidden)update(dt);const lighting=environmentAt(elapsed);gl.uniform3fv(ambientUniform,lighting.ambient);gl.uniform1f(nightUniform,lighting.night);gl.uniform2f(forwardUniform,Math.sin(position.angle),-Math.cos(position.angle));gl.uniform1f(emissionUniform,0);gl.uniform1f(opacityUniform,1);gl.clearColor(...colors.land.map((v,i)=>v*lighting.ambient[i]),1);gl.stencilMask(255);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
 const rx=width/scale/2+20,ry=height/scale/2+20;drawCalls=0;
 const visible=m=>{const b=m.bounds;return !(b[2]<position.x-rx||b[0]>position.x+rx||b[3]<position.y-ry||b[1]>position.y+ry);};
 const drawLayer=(lo,hi)=>{for(const m of meshes){if(m.layer<lo||m.layer>hi||!visible(m))continue;if(m.layer===3){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);}else if(m.layer===4.2){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);}else if(m.layer===4.1){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);}else gl.disable(gl.STENCIL_TEST);if(m.layer===5){if(lighting.night<.001)continue;gl.uniform1f(emissionUniform,1);gl.uniform1f(opacityUniform,lighting.night);}else{gl.uniform1f(emissionUniform,0);gl.uniform1f(opacityUniform,1);}draw(m,position.x,position.y);drawCalls++;}gl.disable(gl.STENCIL_TEST);gl.uniform1f(emissionUniform,0);gl.uniform1f(opacityUniform,1);};
 drawLayer(0,2);drawTrains(false,rx,ry);drawLayer(3,5);
 gl.uniform1f(emissionUniform,1);drawSignals(rx,ry);gl.uniform1f(emissionUniform,.18*lighting.night);draw(car,0,0,position.angle);
 if(lighting.night>.001){gl.uniform1f(emissionUniform,1);gl.uniform1f(opacityUniform,lighting.night);draw(carLamps,0,0,position.angle);}gl.uniform1f(opacityUniform,1);
 // Elevated decks occlude the car. Headlight beams stay below these structures.
 gl.uniform1f(nightUniform,0);drawLayer(6,6);gl.uniform1f(emissionUniform,.2*lighting.night);drawTrains(true,rx,ry);drawLayer(8,8);gl.uniform1f(nightUniform,lighting.night);
 drawNature(rx,ry,lighting);if(frames%3===0){const displayed=Math.min(95,Math.max(0,Math.round(speed/DRIVING.maxSpeed*95)));if(displayed!==lastSpeed){lastSpeed=displayed;String(displayed).padStart(2,'0').split('').forEach((d,i)=>speedDigits[i].forEach((segment,j)=>segment.classList.toggle('on',digitSegments[Number(d)].includes('abcdefg'[j]))));document.getElementById('speedometer').setAttribute('aria-label','速度 '+displayed+' km/h');}gaugeFill.style.strokeDasharray=(speed/720*100).toFixed(1)+' 100';gaugeNeedle.style.transform='rotate('+(speed/720*274).toFixed(1)+'deg)';}
 if(frames%15===0){let nearest=map.labels[0];for(const l of map.labels)if(Math.hypot(l.p[0]-position.x,l.p[1]-position.y)<Math.hypot(nearest.p[0]-position.x,nearest.p[1]-position.y))nearest=l;label.textContent=nearest.name;roadLabel.textContent=position.name||'街をめぐる';document.documentElement.style.setProperty('--panel-bg','rgba('+lighting.panel.map(Math.round).join(',')+',.97)');document.documentElement.style.setProperty('--panel-ink','rgb('+(lighting.phase==='day'?colors.road.map((v,i)=>Math.round(v*lighting.ambient[i]*255)):lighting.ink.map(Math.round)).join(',')+')');document.documentElement.style.setProperty('--credit-shadow',lighting.phase==='day'?'none':'0 1px 2px var(--panel-bg),0 0 3px var(--panel-bg)');canvas.dataset.trees=treeCount;canvas.dataset.removedTrees=rejectedTrees;canvas.dataset.crows=crows.length;canvas.dataset.trainPositions=trains.cars(elapsed).filter(t=>t.car===0).map(t=>t.x.toFixed(1)+','+t.y.toFixed(1)).join(';');canvas.dataset.stencilBits=gl.getParameter(gl.STENCIL_BITS);canvas.dataset.position=position.x.toFixed(1)+','+position.y.toFixed(1);canvas.dataset.startEdge=route.startEdge;canvas.dataset.environment=lighting.phase;canvas.dataset.cycleTime=lighting.cycleTime.toFixed(2);}
 frames++;requestAnimationFrame(frame);}

window.driveDiagnostics=()=>({renderer:'WebGL',ready,frames,elapsed,environment:environmentAt(elapsed),speed,signalCount:signals?.junctions.length,stoppedSeconds:motion?.stoppedSeconds,passedSignals:motion?.passedSignals,position:[position.x,position.y],trips:route?.trips,routePoints:route?.points.length,drawCalls,vertices:meshes.reduce((a,m)=>a+m.count,0),viewport:[width,height],paused,glError:gl.getError()});
fallback.textContent='街を読み込んでいます';fallback.style.display='grid';
fetch('map.json?v=city-12').then(r=>{if(!r.ok)throw Error('Map download failed');return r.json();}).then(build).catch(error=>{console.error(error);fallback.textContent='街を読み込めませんでした。ページを再読み込みしてください。';fallback.style.display='grid';});
})();
