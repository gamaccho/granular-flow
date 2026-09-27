/* One minute: day 25 s, evening 10 s, night 25 s; last 3 s of each phase crossfades. */
(function(root){
'use strict';
const LIGHTING={day:{ambient:[1,1,1],night:0,panel:[245,249,252],ink:[61,83,97]},evening:{ambient:[1,.64,.43],night:0,panel:[104,77,71],ink:[255,231,202]},night:{ambient:[.16,.235,.38],night:1,panel:[23,37,55],ink:[213,229,241]}};
function environmentAt(seconds){const t=((seconds%60)+60)%60;let from,to,blend=0,phase;if(t<25){phase='day';from=LIGHTING.day;to=LIGHTING.evening;blend=Math.max(0,(t-22)/3);}else if(t<35){phase='evening';from=LIGHTING.evening;to=LIGHTING.night;blend=Math.max(0,(t-32)/3);}else{phase='night';from=LIGHTING.night;to=LIGHTING.day;blend=Math.max(0,(t-57)/3);}blend=blend*blend*(3-2*blend);const mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*blend),panel=mix(from.panel,to.panel),luminance=panel.reduce((sum,v,i)=>{v/=255;return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));},0),ink=luminance>.2?[61,83,97]:[245,249,252];return {phase,cycleTime:t,ambient:mix(from.ambient,to.ambient),night:from.night+(to.night-from.night)*blend,panel,ink};}
root.environmentAt=environmentAt;
})(typeof module!=='undefined'?module.exports:window);
