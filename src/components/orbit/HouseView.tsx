import { lazy, Suspense, useEffect, useState } from 'react';
import { FloorPlan, type FloorPlanProps } from './FloorPlan';
import { Button } from '@/components/ui/button';
import { House, Armchair, BriefcaseBusiness } from 'lucide-react';
export type SpaceStyle = 'loft' | 'lounge' | 'office';

const HouseScene=lazy(()=>import('./HouseScene'));
export function HouseView(props: FloorPlanProps) {
  const [mounted,setMounted]=useState(false);
  const [style,setStyle]=useState<SpaceStyle>('loft');
  useEffect(()=>{setMounted(true);const saved=localStorage.getItem('orbit-space-style');if(saved==='loft'||saved==='lounge'||saved==='office')setStyle(saved);},[]);
  return <div className="relative h-full w-full">
    {mounted ? <Suspense fallback={<FloorPlan {...props} />}><HouseScene {...props} spaceStyle={style} /></Suspense> : <FloorPlan {...props} />}
    <div className="absolute top-12 left-1/2 flex -translate-x-1/2 gap-1 rounded-md border bg-card p-1 shadow-soft" role="group" aria-label="Space style">
      {([{id:'loft',name:'Loft',Icon:House},{id:'lounge',name:'Lounge',Icon:Armchair},{id:'office',name:'Office',Icon:BriefcaseBusiness}] as const).map(({id,name,Icon})=><Button key={id} size="sm" variant={style===id?'default':'ghost'} aria-pressed={style===id} onClick={()=>{setStyle(id);localStorage.setItem('orbit-space-style',id);}}><Icon />{name}</Button>)}
    </div>
  </div>;
}