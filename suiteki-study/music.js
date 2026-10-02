(() => {
  'use strict';
  const audio=document.querySelector('#bgm');
  const button=document.querySelector('#sound');
  const status=document.querySelector('#sound-status');
  let starting=false;
  audio.volume=.5;
  function sync(){
    const playing=!audio.paused;
    button.textContent=playing?'sound off':'sound on';
    button.setAttribute('aria-pressed',String(playing));
    button.setAttribute('aria-label',playing?'BGMを停止':'BGMを再生');
  }
  button.addEventListener('click',async()=>{
    if(starting)return;
    status.hidden=true;
    if(!audio.paused){audio.pause();return;}
    starting=true;button.disabled=true;
    try{
      if(navigator.audioSession)navigator.audioSession.type='playback';
      await audio.play();
      sync();
    }catch(error){
      audio.pause();sync();
      status.textContent='音源を再生できませんでした。もう一度お試しください。';
      status.hidden=false;
      console.warn('BGM playback failed.',error);
    }finally{starting=false;button.disabled=false;}
  });
  audio.addEventListener('pause',sync);
  audio.addEventListener('ended',sync);
  audio.addEventListener('error',()=>{audio.pause();sync();});
})();
