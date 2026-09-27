(function(root){
'use strict';
class RoadClearance{
 constructor(roads){this.cells=new Map();for(const r of roads)for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],pad=r.w/2+25,segment={a,b,w:r.w};for(let x=Math.floor((Math.min(a[0],b[0])-pad)/128);x<=Math.floor((Math.max(a[0],b[0])+pad)/128);x++)for(let y=Math.floor((Math.min(a[1],b[1])-pad)/128);y<=Math.floor((Math.max(a[1],b[1])+pad)/128);y++){const key=x+','+y;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(segment);}}}
 clear(x,y,radius){return !(this.cells.get(Math.floor(x/128)+','+Math.floor(y/128))||[]).some(({a,b,w})=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<w/2+radius+5;});}
}
class DriftingClouds{
 constructor(nodes){this.anchors=[];const xs=nodes.map(p=>p[0]),ys=nodes.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/800)*800;x<Math.max(...xs);x+=800)for(let y=Math.floor(Math.min(...ys)/800)*800;y<Math.max(...ys);y+=800){const n=(Math.imul(x,374761393)^Math.imul(y,668265263))>>>0;if(n%10<3)this.anchors.push([x+(n%231),y+(n%173)]);}}
 positions(time){const t=((time%60)+60)%60;return this.anchors.map(([x,y])=>[x+t*8,y+t*2]);}
}
root.DriftingClouds=DriftingClouds;root.RoadClearance=RoadClearance;
})(typeof module!=='undefined'?module.exports:window);
