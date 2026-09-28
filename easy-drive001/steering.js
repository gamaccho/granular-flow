/* Critically damped heading: smooth angular acceleration and settling, no long-way turns. */
(function(root){
 function easeHeading(state,target,dt){
  if(dt<=0)return state;
  const delta=Math.atan2(Math.sin(target-state.angle),Math.cos(target-state.angle));
  const omega=16,error=-delta,term=state.velocity+omega*error,decay=Math.exp(-omega*dt);
  let remaining=(error+term*dt)*decay,velocity=(state.velocity-omega*term*dt)*decay;
  // Avoid overshooting when a new bend reverses the target direction.
  if(remaining*error<0){remaining=0;velocity=0;}
  return {angle:state.angle+delta+remaining,velocity};
 }
 root.easeHeading=easeHeading;
})(typeof module!=='undefined'?module.exports:window);
