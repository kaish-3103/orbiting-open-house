import { useEffect,useRef,useState } from 'react';
import { Music2,Play,Pause,Volume2,VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { musicSchema,musicPosition,type MusicState } from '@/lib/music';
import type { RoomKey } from '@/lib/house';
import jazz from '@/assets/music/jazz.mp3';
import rain from '@/assets/music/rain.mp3';
import classical from '@/assets/music/classical.mp3';
import instrumental from '@/assets/music/instrumental.mp3';
const tracks={jazz,rain,classical,instrumental};
export function RoomMusic({houseId,me,room,people}:{houseId:string;me:string;room:RoomKey|null;people:{user_id:string;display_name:string}[]}) {
 const [open,setOpen]=useState(false),[state,setState]=useState<MusicState|null>(null),[error,setError]=useState(''),[listening,setListening]=useState(false),[volume,setVolume]=useState(.25),[busy,setBusy]=useState(false);
 const audio=useRef<HTMLAudioElement|null>(null),epoch=useRef(0),offset=useRef(0);
 const names=Object.fromEntries(people.map(p=>[p.user_id,p.display_name]));
 const valid=!!room&&room!=='hallway';
 async function action(action:string,payload:Record<string,string|boolean>={}) {
  const current=epoch.current;const started=Date.now();
  const {data,error}=await supabase.rpc('orbit_music',{_house:houseId,_action:action,_payload:payload});
  if(current!==epoch.current)return;
  if(error)throw new Error(error.message);
  const value=musicSchema.parse(data);if(value.room_key!==room)return;
  offset.current=Date.parse(value.now)-(started+Date.now())/2;setState(value);setError('');
 }
 useEffect(()=>{
  epoch.current++;setState(null);setError('');audio.current?.pause();
  if(!valid)return;
  const refresh=()=>void action('snapshot').catch(e=>{setError(e.message);setState(null);audio.current?.pause();});
  refresh();const interval=setInterval(refresh,2000);
  return()=>{epoch.current++;clearInterval(interval);audio.current?.pause();};
 },[houseId,room]);
 useEffect(()=>{
  const el=audio.current;if(!el)return;
  if(!state||!state.playing||!listening){el.pause();return;}
  let active=true;
  const sync=()=>{if(!active)return;const position=musicPosition(state.started_at,Date.now()+offset.current,el.duration);if(Number.isFinite(el.duration)&&Math.abs(el.currentTime-position)>2)el.currentTime=position;void el.play().catch(()=>{if(active){setListening(false);setError('Tap Listen to allow background audio.');}});};
  el.addEventListener('loadedmetadata',sync);sync();
  return()=>{active=false;el.removeEventListener('loadedmetadata',sync);el.pause();};
 },[state?.track,state?.playing,state?.started_at,listening,!!state]);
 useEffect(()=>{if(audio.current)audio.current.volume=volume;},[volume]);
 const run=async(a:string,p:Record<string,string|boolean>={})=>{setBusy(true);try{await action(a,p);}catch(e){setError(e instanceof Error?e.message:'Please retry');}finally{setBusy(false);}};
 const controller=state?.controller_id===me;
 return <>
  <audio ref={audio} src={state?tracks[state.track]:undefined} loop preload="metadata" />
  <div className="flex flex-wrap items-center justify-center gap-2 border-t bg-card px-3 py-1">
   <Button size="sm" variant="ghost" disabled={!valid} onClick={()=>setOpen(true)}><Music2 />Music{state?.playing?` · ${state.track}`:''}</Button>
   {valid&&<Button size="sm" variant="ghost" aria-pressed={listening} onClick={()=>setListening(v=>!v)}>{listening?<Volume2 />:<VolumeX />}{listening?'Listening':'Listen'}</Button>}
  </div>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>Room music</DialogTitle><DialogDescription>{state?`${names[state.controller_id??'']??'A member'} controls the music. Control passes to the earliest remaining member when they leave.`:'Enter a room to choose background music.'}</DialogDescription>
   {error&&<p role="alert" className="text-destructive">{error}</p>}
   {!state&&!error&&<p>Loading room music…</p>}
   {state&&<>
    <div className="grid grid-cols-2 gap-2">{(Object.keys(tracks) as (keyof typeof tracks)[]).map(track=><Button key={track} disabled={!controller||busy} variant={state.track===track?'default':'outline'} onClick={()=>void run('set',{track,playing:state.playing})} className="capitalize"><Music2 />{track}</Button>)}</div>
    <div className="flex flex-wrap gap-2"><Button disabled={!controller||busy} onClick={()=>void run('set',{track:state.track,playing:!state.playing})}>{state.playing?<Pause />:<Play />}{state.playing?'Pause for room':'Play for room'}</Button><Button variant="outline" onClick={()=>setListening(v=>!v)}>{listening?<VolumeX />:<Volume2 />}{listening?'Mute for me':'Listen'}</Button></div>
    <label className="flex items-center gap-3 text-sm"><Volume2 />My volume<input aria-label="My music volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="min-w-0 flex-1" /></label>
    {!controller&&<Button variant="outline" disabled={busy||!!state.requests[me]} onClick={()=>void run('request')}>{state.requests[me]?'Control requested':'Request music control'}</Button>}
    {controller&&Object.keys(state.requests).map(target=><div key={target} className="flex flex-wrap items-center gap-2 border-t pt-2"><span className="flex-1">{names[target]??'Member'} requests control</span><Button size="sm" disabled={busy} onClick={()=>void run('reply',{target,allow:true})}>Give control</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run('reply',{target,allow:false})}>Decline</Button></div>)}
   </>}
  </DialogContent></Dialog>
 </>;
}