import { useEffect, useState, useRef } from 'react';
import { Timer, Users, MessageCircle, Paintbrush, Hand, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FocusPanel } from './FocusPanel';
import { experienceAction, snapshotSchema, type Experience } from '@/lib/experience';
import { timerReading, clock, visitDuration } from '@/lib/focus';
import { ROOMS, STATUS_LABEL, type RoomKey, type Status, type Pt } from '@/lib/house';
type Person = { user_id: string; display_name: string; color: string };
type Peer = { room: RoomKey | null; status: Status };
type Props = { houseId: string; me: string; room: RoomKey | null; people: Person[]; peers: Record<string, Peer>; selected: string | null; select: (id: string | null) => void; move: (p: Pt) => Promise<void>; owner: boolean; onSettings: (settings: Experience['settings']) => void };
export function HouseCompanion({ houseId, me, room, people, peers, selected, select, move, owner, onSettings }: Props) {
  const [data, setData] = useState<Experience | null>(null); const [now, setNow] = useState(Date.now()); const offset = useRef(0);
  const [tab, setTab] = useState<string | null>(null); const [error, setError] = useState(''); const [body, setBody] = useState(''); const [unread, setUnread] = useState(0);
  const [name, setName] = useState(''); const [palette, setPalette] = useState('sage'); const [decor, setDecor] = useState('plant'); const [onboarding, setOnboarding] = useState(false);
  const seen = useRef(new Set<string>()); const messageIds = useRef(new Set<string>()); const initializedMessages = useRef(false); const roomRef = useRef(room); roomRef.current = room; const tabRef = useRef(tab); tabRef.current = tab;
  const names = Object.fromEntries(people.map(p => [p.user_id, p.display_name]));
  useEffect(() => { setOnboarding(localStorage.getItem('orbit-onboarding-dismissed') !== 'yes'); }, []);
  useEffect(() => { setData(d => d ? { ...d, messages: [] } : d); setUnread(0); messageIds.current.clear(); initializedMessages.current = false; if (!room || room === 'hallway') setTab(t => t === 'chat' ? null : t); }, [room]);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const started = Date.now(); const value = snapshotSchema.parse(await experienceAction(houseId, 'snapshot'));
        if (cancelled) return;
        offset.current = Date.parse(value.now) - (started + Date.now()) / 2;
        value.messages = value.messages.filter(m => m.room_key === roomRef.current);
        const fresh = value.messages.filter(m => !messageIds.current.has(m.id) && m.sender_id !== me).length;
        if (initializedMessages.current && tabRef.current !== 'chat') setUnread(n => n + fresh);
        initializedMessages.current = true; value.messages.forEach(m => messageIds.current.add(m.id)); setData(value); setError(''); onSettings(value.settings);
        for (const signal of value.signals) {
          if (seen.current.has(signal.id)) continue; seen.current.add(signal.id);
          const dismiss = () => { void experienceAction(houseId, 'dismiss', { id: signal.id }); };
          if (signal.kind === 'wave') toast(`${names[signal.sender_id] ?? 'A member'} waved hello`, { duration: 5000, cancel: { label: 'Dismiss', onClick: dismiss }, onAutoClose: dismiss });
          else toast(`${names[signal.sender_id] ?? 'A member'} invited you to ${signal.room_key ? ROOMS[signal.room_key as RoomKey]?.label : 'their room'}`, { duration: 15000, action: { label: 'Accept', onClick: () => { dismiss(); const r = signal.room_key ? ROOMS[signal.room_key as RoomKey]?.rect : null; if (r) void move({ x: r.x + r.w / 2, y: r.y + r.h / 2 }); } }, cancel: { label: 'Dismiss', onClick: dismiss } });
        }
      } catch (e) { if (!cancelled) { setData(d => d ? { ...d, messages: [] } : null); setError(e instanceof Error ? e.message : 'Reconnecting…'); } }
    };
    void refresh(); const poll = setInterval(() => void refresh(), 2000); const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => { cancelled = true; clearInterval(poll); clearInterval(tick); };
  }, [houseId, me, room, people, move, onSettings]);
  const action = async (a: string, payload: Record<string, string | number | boolean> = {}) => { try { await experienceAction(houseId, a, payload); const value = snapshotSchema.parse(await experienceAction(houseId, 'snapshot')); value.messages = value.messages.filter(m => m.room_key === roomRef.current); setData(value); if (a === 'message') setBody(''); } catch (e) { toast.error(e instanceof Error ? e.message : 'Please retry'); } };
  const person = people.find(p => p.user_id === selected); const peer = selected ? peers[selected] : null; const visit = data?.visits.find(v => v.user_id === selected);
  const focus = data?.timers.find(t => t.state !== 'complete' && data.participants.some(p => p.user_id === selected && p.session_id === t.id));
  const reading = focus ? timerReading(focus, now) : null;
  return <>
    <div className="flex flex-wrap justify-center gap-1 border-t bg-card px-3 py-2">
      <Button size="sm" variant="ghost" onClick={() => setTab('focus')}><Timer className="h-4 w-4" />Focus</Button>
      <Button size="sm" variant="ghost" onClick={() => setTab('people')}><Users className="h-4 w-4" />People</Button>
      <Button size="sm" variant="ghost" disabled={!room || room === 'hallway'} onClick={() => { setTab('chat'); setUnread(0); }}><MessageCircle className="h-4 w-4" />Chat{unread > 0 ? ` (${unread})` : ''}</Button>
      {owner && <Button size="sm" variant="ghost" onClick={() => setTab('decor')}><Paintbrush className="h-4 w-4" />Your room</Button>}
    </div>
    {onboarding && <div className="flex flex-wrap items-center justify-center gap-2 border-t bg-secondary px-4 py-2 text-sm"><span>Click to walk · Opt into voice · Enter a room to talk. Camera and mic start off.</span><Button size="sm" variant="ghost" onClick={() => { setOnboarding(false); localStorage.setItem('orbit-onboarding-dismissed', 'yes'); }}>Got it</Button></div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) select(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>{person?.display_name ?? 'House member'}</DialogTitle><DialogDescription>House members see your name, color, room, availability, current visit duration and shared focus state. No device activity or work scoring.</DialogDescription>
      {person && <><span className="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl" style={{ background: `var(--${person.color})` }}>{person.display_name[0]}</span><p>{peer ? `${peer.room ? ROOMS[peer.room].label : 'Walking'} · ${STATUS_LABEL[peer.status]}` : 'Disconnected or offline'}</p><p>{visit && !visit.ended_at && peer ? `In this house for ${visitDuration(visit.started_at, now)}` : 'Not currently connected'}</p>{reading && peer && <p>{reading.paused ? 'Focus paused' : reading.complete ? 'Focus completed' : `${reading.phase === 'break' ? 'Break' : 'Focusing'} · ${clock(reading.remaining)} remaining`}</p>}
      {selected !== me && <div className="flex flex-wrap gap-2"><Button disabled={!peer || peer.status === 'dnd'} onClick={() => void action('wave', { target: person.user_id })}><Hand className="h-4 w-4" />Wave</Button><Button variant="outline" disabled={!peer || peer.status === 'dnd' || !room || room === 'hallway'} onClick={() => void action('invite', { target: person.user_id })}><DoorOpen className="h-4 w-4" />Invite to my room</Button></div>}</>}
    </DialogContent></Dialog>
    <Dialog open={!!tab} onOpenChange={open => { if (!open) setTab(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>{tab === 'focus' ? 'Focus together' : tab === 'people' ? 'People in this house' : tab === 'decor' ? 'Your bedroom' : `${room ? ROOMS[room].label : 'Room'} chat`}</DialogTitle><DialogDescription>{tab === 'chat' ? 'Members in this authorized room can read its latest 50 messages, including earlier messages. Leaving or losing access clears this view.' : 'Your shared house'}</DialogDescription>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {tab === 'focus' && (data ? <FocusPanel timers={data.timers} participants={data.participants} me={me} room={room} now={now} names={names} action={action} /> : <p>Loading timers…</p>)}
      {tab === 'people' && people.map(p => <Button className="w-full justify-start" variant="ghost" key={p.user_id} onClick={() => { setTab(null); select(p.user_id); }}>{p.display_name} · {peers[p.user_id] ? 'Here' : 'Offline'}</Button>)}
      {tab === 'chat' && <><div className="max-h-64 space-y-3 overflow-y-auto" aria-live="polite">{!data?.messages.length && <p className="text-sm text-muted-foreground">No messages in this room yet.</p>}{data?.messages.filter(m => m.room_key === room).map(m => <div key={m.id}><div className="text-xs text-muted-foreground">{names[m.sender_id] ?? 'Member'} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><p className="break-words whitespace-pre-wrap text-sm">{m.body}</p></div>)}</div><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void action('message', { body }); }}><Input aria-label="Room message" maxLength={1000} value={body} onChange={e => setBody(e.target.value)} /><Button type="submit" disabled={!body.trim() || !!error}>Send</Button></form></>}
      {tab === 'decor' && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void action('decorate', { name, palette, decor }); }}><label className="block text-sm">Room name<Input maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label><label className="block text-sm">Palette<select className="mt-1 w-full rounded-md border bg-background p-2" value={palette} onChange={e => setPalette(e.target.value)}>{['sage','sky','lavender','honey','coral'].map(c => <option key={c}>{c}</option>)}</select></label><label className="block text-sm">Decor<select className="mt-1 w-full rounded-md border bg-background p-2" value={decor} onChange={e => setDecor(e.target.value)}>{['plant','books','cushions'].map(c => <option key={c}>{c}</option>)}</select></label><Button disabled={!name.trim()}>Save room</Button></form>}
    </DialogContent></Dialog>
  </>;
}