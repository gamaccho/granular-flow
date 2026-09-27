/* Two scheduled buffer voices overlap by exactly four audio-clock seconds. */
(()=>{
 const button=document.getElementById('music'),status=document.getElementById('music-status');
 let context,buffer,loading,playing=false,generation=0,timer,voices=new Set(),next=0;
 const fade=4;
 function voice(start,first){
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(first?.65:0,start);
  if(!first)gain.gain.linearRampToValueAtTime(.65,start+fade);
  gain.gain.setValueAtTime(.65,start+buffer.duration-fade);gain.gain.linearRampToValueAtTime(0,start+buffer.duration);
  source.start(start);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
 }
 function schedule(){if(!playing)return;const now=context.currentTime;while(next<now+8){voice(next,false);next+=buffer.duration-fade;}}
 function stop(){playing=false;generation++;clearInterval(timer);for(const s of voices){try{s.stop();}catch{}}voices.clear();button.textContent='♪';button.setAttribute('aria-busy','false');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','音楽を再生');button.title='Bui Bui Boo — 音楽を再生';status.textContent='';}
 button.addEventListener('click',async()=>{
  if(playing){stop();return;}
  const token=++generation;playing=true;button.setAttribute('aria-busy','true');status.textContent='音楽を読み込み中…';
  try{
   if(navigator.audioSession){try{navigator.audioSession.type='playback';}catch{}}
   context??=new (window.AudioContext||window.webkitAudioContext)();await context.resume();
   loading??=fetch('bui-bui-boo.mp3').then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(e=>{loading=null;throw e;});
   buffer=await loading;if(token!==generation)return;await context.resume();if(token!==generation)return;if(context.state!=='running')throw Error('audio suspended');if(buffer.duration<=8)throw Error('short track');
   button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" style="display:block;margin:auto;fill:currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';button.setAttribute('aria-busy','false');button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','音楽を停止');button.title='Bui Bui Boo — 音楽を停止';status.textContent='';button.dataset.duration=buffer.duration.toFixed(3);button.dataset.crossfade='4';
   const start=context.currentTime+.06;voice(start,true);next=start+buffer.duration-fade;schedule();timer=setInterval(schedule,1000);
  }catch(e){if(token!==generation)return;stop();status.textContent='再生できませんでした。♪をもう一度タップしてください。';}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
})();
