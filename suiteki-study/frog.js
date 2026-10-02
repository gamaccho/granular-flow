/* The supplied ventral photograph is the visible skin, including every toe.
   A textured, skinned mesh deforms that photograph; no illustrated frog shapes. */
class FrogVisitor {
  constructor(random=Math.random){
    this.random=random;
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=512;
    this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:true,preserveDrawingBuffer:true});
    this.limbs=[
      [[231,215],[239,123],[164,191],[207,84]],
      [[215,237],[231,328],[119,344],[176,409]],
      [[378,178],[331,117],[370,78]],
      [[382,211],[347,272],[384,294]]
    ];
    this.bones=[{a:[223,213],b:[404,190],radius:43,limb:-1}];
    this.limbs.forEach((points,limb)=>{
      for(let j=0;j<points.length-1;j++)this.bones.push({a:points[j],b:points[j+1],radius:limb<2?(j?13:20):12,limb,j});
      const end=points.at(-1),before=points.at(-2),dx=end[0]-before[0],dy=end[1]-before[1],length=Math.hypot(dx,dy);
      this.bones.push({a:end,b:[end[0]+dx/length*30,end[1]+dy/length*30],radius:24,limb,j:points.length-1,foot:true});
    });
    this.setupMesh();this.reset();this.ready=this.loadPhoto().catch(error=>console.warn('Frog photo could not be loaded.',error));
  }
  static ease(x){x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);}
  static flight(t,duration,startY=.28){
    // Metres and seconds. z is distance outside the pane; y points down.
    const gravity=9.81,vy=(-startY-.5*gravity*duration*duration)/duration;
    return {y:startY+vy*t+.5*gravity*t*t,z:.85*(1-t/duration),vy:vy+gravity*t};
  }
  reset(){
    this.clock=0;this.next=36+this.random()*8;this.age=-1;this.rect=[0,0,0,0];this.blurAmount=0;
    if(this.gl){this.gl.clearColor(0,0,0,0);this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);}
  }
  setupMesh(){
    const gl=this.gl;if(!gl)return;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 normal;attribute vec2 uv;varying vec2 tex;varying vec3 surface;void main(){tex=uv;surface=normal;gl_Position=vec4(position,1.);}'));
    // Photograph folds/occlusion follow the anatomy. Ambient illumination is
    // evaluated AFTER mirroring, so the street light remains above camera-left.
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 tex;varying vec3 surface;uniform sampler2D photo;void main(){vec4 c=texture2D(photo,tex);if(c.a<.015)discard;float light=.77+.25*max(0.,dot(normalize(surface),normalize(vec3(-.32,-.52,-.79))));gl_FragColor=vec4(c.rgb*light*c.a,c.a);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);this.program=program;gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    // A shallow rounded ventral surface, so tipping the photograph shows body
    // thickness and perspective instead of flattening a rectangular image.
    const depthAt=(x,y)=>{
      const rounded=(cx,cy,rx,ry,depth)=>depth*Math.sqrt(Math.max(0,1-((x-cx)/rx)**2-((y-cy)/ry)**2));
      let depth=Math.max(rounded(280,210,94,45,38),rounded(383,186,66,43,28));
      for(const bone of this.bones){if(bone.limb<0)continue;const dx=bone.b[0]-bone.a[0],dy=bone.b[1]-bone.a[1];
        const t=Math.max(0,Math.min(1,((x-bone.a[0])*dx+(y-bone.a[1])*dy)/(dx*dx+dy*dy)));
        const distance=Math.hypot(x-bone.a[0]-t*dx,y-bone.a[1]-t*dy);
        depth=Math.max(depth,(bone.foot?2.5:bone.radius*.30)*Math.sqrt(Math.max(0,1-(distance/bone.radius)**2)));
      }
      return depth;
    };
    const cols=64,rows=48,vertices=[],uv=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
      const px=x*10,py=y*10;
      const weights=this.bones.map((bone,i)=>{
        const dx=bone.b[0]-bone.a[0],dy=bone.b[1]-bone.a[1];
        const t=Math.max(0,Math.min(1,((px-bone.a[0])*dx+(py-bone.a[1])*dy)/(dx*dx+dy*dy)));
        const distance=Math.hypot(px-bone.a[0]-t*dx,py-bone.a[1]-t*dy);
        return {i,w:Math.exp(-2.5*(distance/bone.radius)**2)};
      }).sort((a,b)=>b.w-a.w).slice(0,3);
      const total=weights.reduce((n,b)=>n+b.w,0);
      if(total<1e-15){weights.length=0;weights.push({i:0,w:1});}else weights.forEach(b=>b.w/=total);
      const depth=depthAt(px,py),nx=-(depthAt(px+1,py)-depthAt(px-1,py))*.5,ny=-(depthAt(px,py+1)-depthAt(px,py-1))*.5;
      const normalLength=Math.hypot(nx,ny,1);
      vertices.push({x:px,y:py,weights,depth,nx:nx/normalLength,ny:ny/normalLength,nz:-1/normalLength});uv.push(px/640,py/480);
      if(x<cols&&y<rows){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
    this.vertices=vertices;this.positions=new Float32Array(vertices.length*3);this.normals=new Float32Array(vertices.length*3);this.count=indices.length;
    this.positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.positions,gl.DYNAMIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);
    this.normalBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.normalBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.normals,gl.DYNAMIC_DRAW);
    const normal=gl.getAttribLocation(program,'normal');gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,0,0);
    const uvs=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvs);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
    const tex=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(tex);gl.vertexAttribPointer(tex,2,gl.FLOAT,false,0,0);
    const triangles=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangles);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program,'photo'),0);
  }
  async loadPhoto(){
    const photo=new Image();photo.src='frog-photo.jpg?v=16';await photo.decode();
    if(!this.gl)return;
    const matte=document.createElement('canvas');matte.width=640;matte.height=480;
    const c=matte.getContext('2d',{willReadFrequently:true});c.drawImage(photo,0,0);
    const pixels=c.getImageData(0,0,640,480),data=pixels.data,n=640*480,score=new Float32Array(n);
    // Isolate the pale/yellow/green animal from the dark neutral glass.
    // Connected foreground rejects dust and scratches outside the animal.
    for(let i=0;i<n;i++){
      const j=i*4,r=data[j],g=data[j+1],b=data[j+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
      score[i]=Math.max(0,Math.min(1,Math.max((hi-105)/32,Math.min((hi-lo-19)/21,(hi-66)/30))));
    }
    const connected=new Uint8Array(n),queue=new Int32Array(n);let read=0,write=1;queue[0]=215*640+280;connected[queue[0]]=1;
    while(read<write){const i=queue[read++],x=i%640;for(const next of [x?i-1:-1,x<639?i+1:-1,i-640,i+640])if(next>=0&&next<n&&!connected[next]&&score[next]>.18){connected[next]=1;queue[write++]=next;}}
    // Preserve dark skin enclosed by foreground, but keep gaps between toes clear.
    const outside=new Uint8Array(n);read=0;write=1;queue[0]=0;outside[0]=1;
    while(read<write){const i=queue[read++],x=i%640;for(const next of [x?i-1:-1,x<639?i+1:-1,i-640,i+640])if(next>=0&&next<n&&!connected[next]&&!outside[next]){outside[next]=1;queue[write++]=next;}}
    for(let i=0;i<n;i++){
      if(!outside[i]){data[i*4+3]=255;continue;}
      // A one-pixel transition retains photographic edges, without a glass rectangle.
      let edge=0;if(i%640&&connected[i-1])edge=1;if(i%640<639&&connected[i+1])edge=1;if(connected[i-640]||connected[i+640])edge=1;
      data[i*4+3]=edge?Math.round(score[i]*180):0;
    }
    c.putImageData(pixels,0,0);this.matte=matte;
    const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,matte);this.loaded=true;
  }
  begin(w,h){
    const r=this.random;this.age=0;this.next=this.clock+36+r()*8;
    this.arrival=.66+r()*.10;this.baseX=w*(.34+r()*.32);this.baseY=h*(.41+r()*.18);
    this.viewWidth=w;this.viewHeight=h;
    this.size=Math.min(245,Math.min(w,h)*.59)*.85;this.angle=-1.12+(r()-.5)*.40;
    this.approachX=(r()-.5)*.22;this.mirror=r()<.5?-1:1;
    this.exitTurn=(r()<.5?-1:1)*(.18+r()*(Math.PI/4-.18));
    this.exitHeading=this.angle+this.exitTurn;
    this.steps=[
      {t:.70,foot:3,d:.24,advance:24},{t:1.10,foot:0,d:.33,advance:23},
      {t:2.65,foot:2,d:.27,advance:39},{t:3.04,foot:1,d:.36,advance:38},
      {t:4.70,foot:3,d:.22,advance:62},{t:5.12,foot:0,d:.31,advance:59},
      {t:6.20,foot:2,d:.28,advance:72},{t:6.60,foot:1,d:.37,advance:69}
    ].map(step=>({...step,t:step.t+(r()-.5)*.13}));
  }
  update(dt,w,h){
    if(!this.loaded)return false;
    this.clock+=dt;if(this.age<0&&this.clock>=this.next)this.begin(w,h);
    if(this.age<0)return false;
    if(w!==this.viewWidth||h!==this.viewHeight){this.baseX*=w/this.viewWidth;this.baseY*=h/this.viewHeight;this.viewWidth=w;this.viewHeight=h;this.size=Math.min(245,Math.min(w,h)*.59)*.85;}
    this.age+=dt;const age=this.age,land=age-this.arrival,departure=land-9.55;
    if(departure>2.25){this.age=-1;this.rect=[0,0,0,0];return false;}
    const ease=FrogVisitor.ease;
    const bodyAdvance=12*ease((land-1.48)/.50)+19*ease((land-3.50)/.58)+20*ease((land-5.56)/.54)+11*ease((land-7.06)/.60);
    let x=0,y=0,z=0,scale=1,impact=0;
    if(land<0){
      const flight=FrogVisitor.flight(age,this.arrival);y=flight.y;z=flight.z;x=this.approachX*(1-age/this.arrival);
    }else if(departure>0){
      // Release outward, then descend under gravity while pitching belly-down.
      z=departure*.48;y=.65*departure+.5*9.81*departure*departure;
      x=this.mirror*Math.sin(this.exitTurn)*.22*departure;
    }else{
      impact=Math.sin(land*27)*Math.exp(-land*13);scale=1-impact*.045;
    }
    const projection=.56/(.56+z),unit=Math.min(w,h)/.64,travel=bodyAdvance*.82/512*this.size;
    this.blurAmount=Math.min(1,z/.75);
    this.rect=[(this.baseX+(x*unit+this.mirror*Math.cos(this.angle)*travel)*projection)/w,1-(this.baseY+(y*unit+Math.sin(this.angle)*travel)*projection)/h,this.size*projection*scale/w,this.size*projection*scale/h];
    // First clear the toe pads from the pane; keep tipping during the visible fall.
    const pitch=Math.PI*.5*ease((departure-.02)/.48);
    this.state={age,land,departure,z,projection,bodyAdvance,impact,pitch};
    this.draw();return true;
  }
  solveChain(rest,target){
    const p=rest.map(v=>v.slice()),lengths=rest.slice(1).map((v,i)=>Math.hypot(v[0]-rest[i][0],v[1]-rest[i][1]));
    for(let pass=0;pass<5;pass++){
      p[p.length-1]=target.slice();
      for(let i=p.length-2;i>=0;i--){const dx=p[i][0]-p[i+1][0],dy=p[i][1]-p[i+1][1],s=lengths[i]/Math.max(.001,Math.hypot(dx,dy));p[i]=[p[i+1][0]+dx*s,p[i+1][1]+dy*s];}
      p[0]=rest[0].slice();
      for(let i=1;i<p.length;i++){const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],s=lengths[i-1]/Math.max(.001,Math.hypot(dx,dy));p[i]=[p[i-1][0]+dx*s,p[i-1][1]+dy*s];}
    }
    return p;
  }
  draw(){
    const {age,land,departure,bodyAdvance,impact,pitch}=this.state,ease=FrogVisitor.ease;
    const turnAt=t=>(this.exitHeading-this.angle)*ease((t-7.72)/1.25);
    const turn=turnAt(land);
    const chains=this.limbs.map((rest,foot)=>{
      const end=rest.at(-1),root=rest[0];let advance=0,lift=0;
      for(const step of this.steps)if(step.foot===foot&&land>step.t){const p=Math.min(1,(land-step.t)/step.d);advance+=(step.advance-advance)*ease(p);if(p<1)lift=Math.sin(p*Math.PI);}
      let dx=advance-bodyAdvance,dy=lift*(foot%2?5:-5),tuck=0;
      if(land>7.72){
        // Eight staggered replantings let the body turn while each supporting
        // foot stays at its last angle on the pane until that foot releases.
        let planted=0;
        for(const start of [[7.82,8.52],[8.02,8.72],[7.92,8.62],[7.72,8.42]][foot]){
          if(land>start){const p=Math.min(1,(land-start)/.22);planted+=(turnAt(start+.22)-planted)*ease(p);if(p<1)lift=Math.sin(p*Math.PI);}
        }
        // A foot releases before twisting its leg beyond the available reach.
        // Limit torsion of the photographic skin at the shoulder/hip joints.
        const a=Math.max(-.16,Math.min(.16,planted-turn)),px=end[0]+dx-285,py=end[1]+dy-238;
        dx=285+px*Math.cos(a)-py*Math.sin(a)-end[0];
        dy=238+px*Math.sin(a)+py*Math.cos(a)-end[1];
        dx+=(root[0]-end[0])*.025*lift;dy+=(root[1]-end[1])*.025*lift;
      }
      if(land<0){const t=age/this.arrival;tuck=foot<2?.42*(1-ease(t/.13))-.14*Math.sin(Math.PI*t)*(1-ease((t-.64)/.26)):.32*(1-ease((t-.42)/.40));}
      else if(departure>0){tuck=foot<2?.18-.42*ease(departure/.10)+.48*ease((departure-.22)/.45):.18+.02*ease(departure/.45);}
      else{tuck=.18*ease((land-9.05)/.50);dy+=impact*(foot%2?9:-9);}
      dx+=(root[0]-end[0])*tuck;dy+=(root[1]-end[1])*tuck;
      return this.solveChain(rest,[end[0]+dx,end[1]+dy]);
    });
    const transforms=this.bones.map(bone=>{
      if(bone.limb<0)return {a:bone.a,cos:1,sin:0};
      const chain=chains[bone.limb];let a=chain[bone.j],b=chain[bone.j+1];
      if(bone.foot){const before=chain[chain.length-2],end=chain.at(-1),dx=end[0]-before[0],dy=end[1]-before[1],length=Math.hypot(dx,dy);a=end;b=[a[0]+dx/length*30,a[1]+dy/length*30];}
      const angle=Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(bone.b[1]-bone.a[1],bone.b[0]-bone.a[0]);
      return {a,cos:Math.cos(angle),sin:Math.sin(angle)};
    });
    const angle=this.angle+turn+(land<0?.12*Math.sin(age/this.arrival*Math.PI):impact*.025);
    const cos=Math.cos(angle),sin=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch);
    this.vertices.forEach((vertex,i)=>{
      let x=0,y=0,nx=0,ny=0;for(const influence of vertex.weights){const bone=this.bones[influence.i],tr=transforms[influence.i],dx=vertex.x-bone.a[0],dy=vertex.y-bone.a[1];x+=(tr.a[0]+dx*tr.cos-dy*tr.sin)*influence.w;y+=(tr.a[1]+dx*tr.sin+dy*tr.cos)*influence.w;nx+=(vertex.nx*tr.cos-vertex.ny*tr.sin)*influence.w;ny+=(vertex.nx*tr.sin+vertex.ny*tr.cos)*influence.w;}
      x-=285;y-=238;
      const px=this.mirror*(x*cos-y*sin),py=x*sin+y*cos;
      const pz=py*sp-vertex.depth*cp,tiltedY=py*cp+vertex.depth*sp;
      const perspective=650/(650+pz*sp);
      this.positions[i*3]=px*perspective*.82/256;this.positions[i*3+1]=-tiltedY*perspective*.82/256;this.positions[i*3+2]=pz/512;
      const normalX=this.mirror*(nx*cos-ny*sin),normalY=nx*sin+ny*cos;
      // Pitch is in world space; mirroring the animal must not flip gravity.
      this.normals[i*3]=normalX;this.normals[i*3+1]=normalY*cp-vertex.nz*sp;this.normals[i*3+2]=normalY*sp+vertex.nz*cp;
    });
    const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,this.positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.positions);gl.bindBuffer(gl.ARRAY_BUFFER,this.normalBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.normals);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
  }
}
if(typeof module!=='undefined')module.exports=FrogVisitor;
