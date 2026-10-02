/* Two scheduled buffer voices overlap by exactly four audio-clock seconds. */
(()=>{
 const button=document.getElementById('sound'),status=document.getElementById('sound-status');
 let context,buffer,loading,playing=false,generation=0,timer,voices=new Set(),next=0;
 const fade=4;
 function voice(start,first){
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(first?.5:0,start);
  if(!first)gain.gain.linearRampToValueAtTime(.5,start+fade);
  gain.gain.setValueAtTime(.5,start+buffer.duration-fade);gain.gain.linearRampToValueAtTime(0,start+buffer.duration);
  source.start(start);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
 }
 function schedule(){if(!playing)return;const now=context.currentTime;while(next<now+8){voice(next,false);next+=buffer.duration-fade;}}
 function stop(){playing=false;generation++;clearInterval(timer);for(const s of voices){try{s.stop();}catch{}}voices.clear();button.textContent='sound on';button.setAttribute('aria-busy','false');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','音楽を再生');button.title='音楽を再生';status.textContent='';}
 button.addEventListener('click',async()=>{
  if(playing){stop();return;}
  const token=++generation;playing=true;button.setAttribute('aria-busy','true');status.hidden=false;status.textContent='音楽を読み込み中…';
  try{
   if(navigator.audioSession){try{navigator.audioSession.type='playback';}catch{}}
   context??=new (window.AudioContext||window.webkitAudioContext)();await context.resume();
   loading??=fetch('warm-rhodes-chords.mp3').then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(e=>{loading=null;throw e;});
   buffer=await loading;if(token!==generation)return;await context.resume();if(token!==generation)return;if(context.state!=='running')throw Error('audio suspended');if(buffer.duration<=8)throw Error('short track');
   button.textContent='sound off';button.setAttribute('aria-busy','false');button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','音楽を停止');button.title='音楽を停止';status.textContent='';button.dataset.duration=buffer.duration.toFixed(3);button.dataset.crossfade='4';
   const start=context.currentTime+.06;voice(start,true);next=start+buffer.duration-fade;schedule();timer=setInterval(schedule,1000);
  }catch(e){if(token!==generation)return;stop();status.textContent='再生できませんでした。sound onをもう一度タップしてください。';}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
})();
