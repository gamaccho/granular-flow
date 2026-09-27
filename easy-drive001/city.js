/* OSM-based city details and continuous trains; shared simulation clock. */
(function(root){
'use strict';
function along(points,d){let offset=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<=offset+length||i===points.length-1){const t=Math.max(0,Math.min(1,(d-offset)/(length||1)));return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2,segment:i-1};}offset+=length;}return null;}
function pathLength(p){return p.slice(1).reduce((s,b,i)=>s+Math.hypot(b[0]-p[i][0],b[1]-p[i][1]),0);}
class CityTrains{
 constructor(tracks,random=Math.random){this.tracks=tracks.map(t=>({...t,length:pathLength(t.p),offset:random()*pathLength(t.p)}));}
 cars(time){const result=[];for(const [track,t] of this.tracks.entries()){const spacing=51,trainLength=11*spacing,cycle=t.length+trainLength+850;for(let service=0;service<3;service++){const head=(time*150+t.offset+service*cycle/3)%cycle;for(let car=0;car<11;car++){const d=head-car*spacing;if(d<24||d>t.length-24)continue;const p=along(t.p,d),segment=t.segments[p.segment];if(segment.tunnel)continue;result.push({...p,elevated:segment.elevated,track,service,car});}}}return result;}
}
root.cityAlong=along;root.cityPathLength=pathLength;root.CityTrains=CityTrains;
})(typeof module!=='undefined'?module.exports:window);
