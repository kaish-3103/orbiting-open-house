import { expect,it } from 'vitest';
import { musicPosition,musicSchema } from './music';
it('synchronizes late listeners to the authoritative loop time',()=>{expect(musicPosition('2026-11-07T23:00:00Z',Date.parse('2026-11-07T23:01:05Z'),48)).toBe(17);});
it('rejects tracks outside the four selections',()=>{expect(musicSchema.safeParse({room_key:'lounge',controller_id:null,track:'pop',playing:false,started_at:'now',now:'now',requests:{}}).success).toBe(false);});