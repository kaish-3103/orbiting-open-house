import { z } from 'zod';
export const musicSchema=z.object({room_key:z.string(),controller_id:z.string().nullable(),track:z.enum(['jazz','rain','classical','instrumental']),playing:z.boolean(),started_at:z.string(),now:z.string(),requests:z.record(z.string(),z.string())});
export type MusicState=z.infer<typeof musicSchema>;
export function musicPosition(start:string,now:number,duration:number) {return duration>0?Math.max(0,(now-Date.parse(start))/1000)%duration:0;}