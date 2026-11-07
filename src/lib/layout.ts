import type { Pt } from './house';
export type SpaceStyle = 'loft' | 'lounge' | 'office';
export const LAYOUTS = [
  {id:'loft',name:"Founders’ Loft",description:'Balanced private rooms, lounge and kitchen.'},
  {id:'lounge',name:'Social Lounge',description:'Compact quiet corners above a wide social floor.'},
  {id:'office',name:'Cooperative Office',description:'Deep work cabins, a broad corridor and compact meeting areas.'},
] as const;
function interpolate(value:number,from:number[],to:number[]) {
  let i=0; while(i<from.length-2 && value>(from[i+1] ?? value)) i++;
  const a=from[i] ?? 0,b=from[i+1] ?? 1,c=to[i] ?? 0,d=to[i+1] ?? 1;
  return c+(value-a)/(b-a)*(d-c);
}
const axes=(style:SpaceStyle)=>({x:style==='lounge'?[40,740,1160]:style==='office'?[40,460,1160]:[40,600,1160],y:style==='lounge'?[40,240,330,740]:style==='office'?[40,440,540,740]:[40,340,420,740]});
export function layoutPoint(p:Pt,style:SpaceStyle,inverse=false):Pt {
  const a=axes(style),x=[40,600,1160],y=[40,340,420,740];
  return {x:interpolate(p.x,inverse?a.x:x,inverse?x:a.x),y:interpolate(p.y,inverse?a.y:y,inverse?y:a.y)};
}