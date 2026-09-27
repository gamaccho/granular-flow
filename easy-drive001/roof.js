(function(root){
'use strict';
// Length-weighted orthogonal wall directions define the building's own roof axes.
function roofAngle(points){let x=0,y=0,longest=0,fallback=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);x+=length*Math.cos(angle*4);y+=length*Math.sin(angle*4);if(length>longest){longest=length;fallback=angle;}}return Math.hypot(x,y)<longest*.15?fallback:Math.atan2(y,x)/4;}
function roofPoint(center,angle,x,y){const c=Math.cos(angle),s=Math.sin(angle);return [center[0]+x*c-y*s,center[1]+x*s+y*c];}
root.roofAngle=roofAngle;root.roofPoint=roofPoint;
})(typeof module!=='undefined'?module.exports:window);
