(() => {
  'use strict';
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl', {alpha:false, antialias:false, depth:false, powerPreference:'low-power'});
  const error = document.querySelector('#error');
  function fail(message) { error.textContent=message; error.hidden=false; }
  if (!gl) { fail('このブラウザでは水滴を描画できません。WebGL対応のブラウザで開いてください。'); return; }
  const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
uniform vec2 resolution;uniform vec4 drops[40];uniform float night;uniform float time;
uniform vec4 sprayDrops[45];uniform int sprayCount;
uniform sampler2D street;uniform sampler2D mist;uniform sampler2D streetBlur;
uniform sampler2D frogImage;uniform vec4 frogRect;
uniform float frogBlurAmount;uniform float pixelRatio;
float haze;
vec4 frogThroughGlass(vec2 uv){
  float defocus=max(smoothstep(.03,1.,haze)*.27,clamp(frogBlurAmount,0.,1.)*.65);
  // Mipmaps and all nine taps contain premultiplied color. Transparent pixels
  // therefore soften the silhouette without importing a dark cutout fringe.
  float bias=log2(1.+14.*pixelRatio*defocus);
  vec2 d=vec2(5.5*pixelRatio*defocus)/(frogRect.zw*resolution);
  vec4 c=texture2D(frogImage,uv,bias)*.25;
  c+=texture2D(frogImage,uv+vec2(d.x,0.),bias)*.125;
  c+=texture2D(frogImage,uv-vec2(d.x,0.),bias)*.125;
  c+=texture2D(frogImage,uv+vec2(0.,d.y),bias)*.125;
  c+=texture2D(frogImage,uv-vec2(0.,d.y),bias)*.125;
  c+=texture2D(frogImage,uv+d,bias)*.0625;
  c+=texture2D(frogImage,uv-d,bias)*.0625;
  c+=texture2D(frogImage,uv+vec2(d.x,-d.y),bias)*.0625;
  c+=texture2D(frogImage,uv+vec2(-d.x,d.y),bias)*.0625;
  return c;
}
vec3 paper(vec2 p){
  vec2 uv=p*min(resolution.x,resolution.y)/resolution+.5;
  float aspect=resolution.x/resolution.y;
  if(aspect<1.)uv.x=(uv.x-.5)*aspect+.5;
  else uv.y=uv.y/aspect;
  vec3 c=texture2D(street,uv).rgb*.20;
  vec2 r=vec2(.0015);
  c+=texture2D(street,uv+vec2(r.x,0.)).rgb*.12;
  c+=texture2D(street,uv-vec2(r.x,0.)).rgb*.12;
  c+=texture2D(street,uv+vec2(0.,r.y)).rgb*.12;
  c+=texture2D(street,uv-vec2(0.,r.y)).rgb*.12;
  c+=texture2D(street,uv+r).rgb*.08;
  c+=texture2D(street,uv-r).rgb*.08;
  c+=texture2D(street,uv+vec2(r.x,-r.y)).rgb*.08;
  c+=texture2D(street,uv+vec2(-r.x,r.y)).rgb*.08;
  return mix(c,texture2D(streetBlur,uv).rgb,haze)*mix(1.15,.88,night);
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
  haze=texture2D(mist,gl_FragCoord.xy/resolution).r;
  float f=0.;vec2 gradient=vec2(0.);
  for(int i=0;i<40;i++){
    vec4 d=drops[i];vec2 offset=p-d.xy;float r=d.z;
    // A rounded advancing head and a narrowing receding tail, not a stretched sphere.
    float elong=max(d.w-1.,0.);
    float sy=offset.y>0.?max(d.w,1.):1.+elong*.18;
    float narrow=sqrt(1.+elong*.45);
    float neck=.85*min(1.,elong);
    float taper=narrow*(1.+max(offset.y,0.)/max(r*sy,.001)*neck);
    vec2 v=vec2(offset.x*taper,offset.y/sy);
    float rr=max(r*r,.000001);
    float q=dot(v,v)/rr;float e=exp(-q*2.8)*2.2*step(.001,r);
    float taperY=offset.y>0.?narrow*neck/max(r*sy,.001):0.;
    f+=e;gradient+=e*(-5.6)*vec2(v.x*taper,v.y/sy+v.x*offset.x*taperY)/rr;

  }
  vec3 bg=paper(p);vec3 col=bg;
  float edge=smoothstep(.96,1.04,f);
  if(f>.96){
    float h=sqrt(max(0.,1.-1./max(f,1.)));
    vec2 outward=-normalize(gradient+vec2(.00001));
    vec3 n=normalize(vec3(outward*(1.-h)*1.6*smoothstep(0.,8.,length(gradient)),.42+h));
    vec2 bend=n.xy*(.06+.075*h);
    // Exterior drops transmit and distort the street; no synthetic indoor lamps.
    vec3 refracted=paper(p+bend*.72);
    float rim=exp(-abs(f-1.08)*18.);
    vec3 outdoor=paper(p-bend*1.4);
    vec3 water=mix(refracted,outdoor,rim*.20)*(1.-rim*.13);
    col=mix(col,water,edge);
  }
  if(frogRect.z>0.){
    vec2 uv=(gl_FragCoord.xy/resolution-frogRect.xy)/frogRect.zw+.5;
    if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.){
      vec4 frog=frogThroughGlass(uv);
      col=col*(1.-frog.a)+frog.rgb*mix(.83,.66,night);
    }
  }
  // Small airborne droplets at the sill transmit/refract the same street as
  // the window drops. Keep the work inside the narrow splash-height band.
  if(sprayCount>0&&p.y<-.5*resolution.y/min(resolution.x,resolution.y)+.14){
    for(int i=0;i<45;i++){
      if(i>=sprayCount)break;
      vec4 s=sprayDrops[i];vec2 v=(p-s.xy)/max(s.z,.00001);v.y/=1.3;
      float q=dot(v,v);
      if(q<1.){
        vec2 bend=v*.014;
        float rim=smoothstep(.45,.95,q);
        vec3 transmitted=paper(p+bend);
        vec3 reflected=paper(p-bend*1.6);
        vec3 bead=mix(transmitted,reflected,rim*.22)*(1.-rim*.12);
        col=mix(col,bead,(1.-smoothstep(.66,1.,q))*s.w*.85);
      }
    }
  }
  float veil=haze*(.34+.055*sin(p.x*5.+p.y*3.));
  col=mix(col,vec3(.30,.34,.35)+bg*.16,veil);
  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
  col+=grain*.003;gl_FragColor=vec4(col,1.);
}`;
  function compile(type, source) { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  let program;
  try { program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)); }
  catch(e){console.error(e);fail('描画の準備ができませんでした。別のブラウザでお試しください。');return;}
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(['resolution','drops[0]','sprayDrops[0]','sprayCount','night','time'].map(k=>[k,gl.getUniformLocation(program,k)]));
  const streetScene=new StreetScene();const streetTexture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,streetTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(program,'street'),0);
  const blurTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,blurTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(gl.getUniformLocation(program,'streetBlur'),2);
  const fog=document.createElement('canvas');fog.width=fog.height=256;const fogCtx=fog.getContext('2d');
  const fogTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,fogTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program,'mist'),1);let fogDirty=true,previousWipe=null,fogRecovering=false,fogUpdated=performance.now();
  const fogLevels=new Float32Array(256*256);
  function resetFog(){fogCtx.fillStyle='#fff';fogCtx.fillRect(0,0,256,256);fogLevels.fill(255);fogRecovering=false;fogUpdated=performance.now();fogDirty=true;}
  function recoverFog(now,force=false){
    const elapsed=(now-fogUpdated)/1000;if(!force&&elapsed<.1)return;fogUpdated=now;
    if(!fogRecovering)return;const pixels=fogCtx.getImageData(0,0,256,256);fogRecovering=false;
    for(let i=0;i<fogLevels.length;i++){const value=Math.min(255,fogLevels[i]+elapsed*255/30);fogLevels[i]=value;if(value<255)fogRecovering=true;const j=i*4;pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=Math.round(value);}
    fogCtx.putImageData(pixels,0,0);fogDirty=true;
  }
  function wipe(e){
    recoverFog(performance.now(),true);
    const x=e.clientX/width*256,y=e.clientY/height*256;
    const rx=27/width*256,ry=27/height*256;
    const start=previousWipe||{x,y};const steps=Math.max(1,Math.ceil(Math.hypot((x-start.x)/rx,(y-start.y)/ry)*3));
    for(let i=0;i<=steps;i++){const k=i/steps;fogCtx.save();fogCtx.translate(start.x+(x-start.x)*k,start.y+(y-start.y)*k);fogCtx.scale(rx,ry);const g=fogCtx.createRadialGradient(0,0,.55,0,0,1);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');fogCtx.fillStyle=g;fogCtx.fillRect(-1,-1,2,2);fogCtx.restore();}
    const pixels=fogCtx.getImageData(0,0,256,256).data;for(let i=0;i<fogLevels.length;i++)fogLevels[i]=pixels[i*4];
    fogRecovering=true;previousWipe={x,y};fogDirty=true;
  }
  const visitor=new FrogVisitor();const frogTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,frogTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program,'frogImage'),3);
  const frogRect=gl.getUniformLocation(program,'frogRect');
  const frogBlurAmount=gl.getUniformLocation(program,'frogBlurAmount');
  const pixelRatio=gl.getUniformLocation(program,'pixelRatio');
  function uploadFrog(){
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,frogTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,visitor.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  }
  uploadFrog();
  const packed=new Float32Array(160),packedSpray=new Float32Array(180);const rain=new RainGlass();let drops=rain.drops,width=1,height=1,unit=1,held=null,pointerId=null,target={x:0,y:0},last=0,night=0,nightTarget=0;
  function resize(){width=innerWidth;height=innerHeight;unit=Math.min(width,height);const scale=Math.min(devicePixelRatio||1,1.65,Math.sqrt(1800000/(width*height)));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);gl.viewport(0,0,canvas.width,canvas.height);rain.bounds(width/unit,height/unit);}
  function reset(){visitor.reset();held=null;rain.reset();drops=rain.drops;resetFog();}
  function point(e){return {x:(e.clientX-width/2)/unit,y:(height/2-e.clientY)/unit};}
  canvas.addEventListener('pointerdown',e=>{if(pointerId!==null)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);previousWipe=null;wipe(e);});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointerId)wipe(e);});
  function release(e){if(e.pointerId===pointerId){held=null;pointerId=null;previousWipe=null;}}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  document.querySelector('#reset').addEventListener('click',reset);
  document.querySelector('#light').addEventListener('click',e=>{nightTarget=1-nightTarget;e.target.textContent=nightTarget?'明るく':'暗く';e.target.setAttribute('aria-pressed',String(!!nightTarget));document.body.classList.add('dark');});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('描画が一時停止しました。ページを再読み込みしてください。');});
  function frame(ms){
    requestAnimationFrame(frame);if(document.hidden||gl.isContextLost()){last=ms;return;}
    const dt=Math.min((ms-last)/1000,.035)||.016;last=ms;const t=ms*.001;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,streetTexture);
    if(streetScene.update(t)){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,streetScene.texture);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,blurTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,streetScene.blur);}
    if(visitor.update(dt,width,height))uploadFrog();
    gl.uniform4fv(frogRect,visitor.rect);
    gl.uniform1f(frogBlurAmount,visitor.blurAmount||0);
    gl.uniform1f(pixelRatio,canvas.width/width);
    recoverFog(ms);
    if(fogDirty){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,fogTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,fog);fogDirty=false;}
    held=rain.step(dt,held,target);drops=rain.drops;
    packedSpray.fill(0);rain.spray.forEach((s,i)=>packedSpray.set([s.x,s.y,s.r,Math.min(1,s.life*4)],i*4));
    gl.uniform1i(uniforms.sprayCount,rain.spray.length);gl.uniform4fv(uniforms['sprayDrops[0]'],packedSpray);
    packed.fill(0);drops.forEach((d,i)=>packed.set([d.x,d.y,d.r,rain.stretch(d)],i*4));night+=(nightTarget-night)*Math.min(1,dt*3);
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform4fv(uniforms['drops[0]'],packed);gl.uniform1f(uniforms.night,night);gl.uniform1f(uniforms.time,t);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  resize();reset();addEventListener('resize',resize);requestAnimationFrame(frame);
})();
