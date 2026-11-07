import { expect,it } from 'vitest';
import { layoutPoint } from './layout';
it('gives lounge shorter quiet rooms and a wider social floor',()=>{expect(layoutPoint({x:600,y:340},'lounge')).toEqual({x:740,y:240});});
it('gives office deeper cabins and compact meeting floor',()=>{expect(layoutPoint({x:600,y:420},'office')).toEqual({x:460,y:540});});
it('maps clicks back to authorized coordinates for all layouts',()=>{for(const style of ['loft','lounge','office'] as const){const p={x:900,y:600};const back=layoutPoint(layoutPoint(p,style),style,true);expect(back.x).toBeCloseTo(900);expect(back.y).toBeCloseTo(600);}});