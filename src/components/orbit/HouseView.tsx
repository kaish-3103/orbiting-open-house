import { lazy, Suspense, useEffect, useState } from 'react';
import { FloorPlan, type FloorPlanProps } from './FloorPlan';
import type { SpaceStyle } from '@/lib/layout';
export type { SpaceStyle } from '@/lib/layout';

const HouseScene=lazy(()=>import('./HouseScene'));
export function HouseView({spaceStyle='loft',...props}: FloorPlanProps & {spaceStyle?:SpaceStyle}) {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{setMounted(true);},[]);
  return <div className="relative h-full w-full">
    {mounted ? <Suspense fallback={<FloorPlan {...props} />}><HouseScene {...props} spaceStyle={spaceStyle} /></Suspense> : <FloorPlan {...props} />}
  </div>;
}