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
uniform sampler2D street;
vec3 paper(vec2 p){
  vec2 uv=p*min(resolution.x,resolution.y)/resolution+.5;
  float aspect=resolution.x/resolution.y;
  if(aspect<1.)uv.x=(uv.x-.5)*aspect+.5;
  else uv.y=uv.y/aspect;
  vec3 c=texture2D(street,uv).rgb*.20;
  vec2 r=vec2(.004);
  c+=texture2D(street,uv+vec2(r.x,0.)).rgb*.12;
  c+=texture2D(street,uv-vec2(r.x,0.)).rgb*.12;
  c+=texture2D(street,uv+vec2(0.,r.y)).rgb*.12;
  c+=texture2D(street,uv-vec2(0.,r.y)).rgb*.12;
  c+=texture2D(street,uv+r).rgb*.08;
  c+=texture2D(street,uv-r).rgb*.08;
  c+=texture2D(street,uv+vec2(r.x,-r.y)).rgb*.08;
  c+=texture2D(street,uv+vec2(-r.x,r.y)).rgb*.08;
  return c*mix(1.15,.88,night);
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
  float f=0.;vec2 gradient=vec2(0.);float shadow=0.;
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
    vec2 sv=v+vec2(-.013,.024);shadow+=exp(-dot(sv,sv)/max(r*r,.000001)*2.4)*.18*step(.001,r);
  }
  vec3 bg=paper(p);vec3 col=bg*(1.-min(shadow,.25));
  float edge=smoothstep(.96,1.04,f);
  if(f>.96){
    float h=sqrt(max(0.,1.-1./max(f,1.)));
    vec2 outward=-normalize(gradient+vec2(.00001));
    vec3 n=normalize(vec3(outward*(1.-h)*1.6*smoothstep(0.,8.,length(gradient)),.42+h));
    vec2 bend=n.xy*(.06+.075*h);
    vec3 refracted=paper(p-bend);
    float fres=pow(1.-n.z,3.);
    vec3 reflection=mix(vec3(.94,.98,1.),vec3(.55,.79,.87),night);
    vec3 water=mix(refracted,reflection,.08+fres*.6);
    float highlight=pow(max(dot(n,normalize(vec3(-.55,.7,1.))),0.),65.);
    float small=pow(max(dot(n,normalize(vec3(.65,-.65,.55))),0.),90.);
    float rim=exp(-abs(f-1.08)*18.);
    water+=highlight*.65+small*.28;
    water-=rim*.10;
    water+=rim*pow(max(dot(outward,normalize(vec2(-.7,.9))),0.),5.)*.32;
    water+=vec3(.8,.95,.9)*pow(max(dot(outward,normalize(vec2(.5,-.8))),0.),9.)*exp(-abs(f-1.35)*8.)*.18;
    col=mix(col,water,edge);
  }
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
  const uniforms=Object.fromEntries(['resolution','drops[0]','night','time'].map(k=>[k,gl.getUniformLocation(program,k)]));
  const streetScene=new StreetScene();const streetTexture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,streetTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(program,'street'),0);
  const packed=new Float32Array(160);const rain=new RainGlass();let drops=rain.drops,width=1,height=1,unit=1,held=null,pointerId=null,target={x:0,y:0},last=0,night=1,nightTarget=1;
  const spray=document.querySelector('#spray');const ctx=spray.getContext('2d');
  function resize(){width=innerWidth;height=innerHeight;unit=Math.min(width,height);const scale=Math.min(devicePixelRatio||1,1.65,Math.sqrt(1800000/(width*height)));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);gl.viewport(0,0,canvas.width,canvas.height);spray.width=canvas.width;spray.height=canvas.height;rain.bounds(width/unit,height/unit);}
  function reset(){held=null;rain.reset();drops=rain.drops;}
  function point(e){return {x:(e.clientX-width/2)/unit,y:(height/2-e.clientY)/unit};}
  canvas.addEventListener('pointerdown',e=>{if(pointerId!==null)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);target=point(e);held=drops.reduce((best,d)=>Math.hypot(d.x-target.x,d.y-target.y)<d.r*.95&&(!best||Math.hypot(d.x-target.x,d.y-target.y)<Math.hypot(best.x-target.x,best.y-target.y))?d:best,null);if(!held&&drops.length<40){held=rain.add(target.x,target.y,rain.rainRadius);}});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointerId)target=point(e);});
  function release(e){if(e.pointerId===pointerId){held=null;pointerId=null;}}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  document.querySelector('#reset').addEventListener('click',reset);
  document.querySelector('#light').addEventListener('click',e=>{nightTarget=1-nightTarget;e.target.textContent=nightTarget?'明るく':'暗く';e.target.setAttribute('aria-pressed',String(!!nightTarget));document.body.classList.add('dark');});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('描画が一時停止しました。ページを再読み込みしてください。');});
  function frame(ms){
    requestAnimationFrame(frame);if(document.hidden||gl.isContextLost()){last=ms;return;}
    const dt=Math.min((ms-last)/1000,.035)||.016;last=ms;const t=ms*.001;
    if(streetScene.update(t))gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,streetScene.texture);
    held=rain.step(dt,held,target);drops=rain.drops;
    ctx.clearRect(0,0,spray.width,spray.height);
    const pixels=Math.min(spray.width,spray.height);
    for(const s of rain.spray){ctx.globalAlpha=Math.min(1,s.life*3)*.75;ctx.fillStyle=night>.5?'#c8eeee':'#ffffff';ctx.beginPath();ctx.ellipse(spray.width/2+s.x*pixels,spray.height/2-s.y*pixels,s.r*pixels,s.r*pixels*1.3,0,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    packed.fill(0);drops.forEach((d,i)=>packed.set([d.x,d.y,d.r,rain.stretch(d)],i*4));night+=(nightTarget-night)*Math.min(1,dt*3);
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform4fv(uniforms['drops[0]'],packed);gl.uniform1f(uniforms.night,night);gl.uniform1f(uniforms.time,t);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  resize();reset();addEventListener('resize',resize);requestAnimationFrame(frame);
})();
