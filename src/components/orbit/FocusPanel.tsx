import { useState } from 'react';
import { Pause, Play, RotateCcw, LogOut, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clock, timerReading, type FocusTimer } from '@/lib/focus';
type Props = { timers: FocusTimer[]; participants: { session_id: string; user_id: string }[]; me: string; room: string | null; now: number; action: (action: string, payload?: Record<string, string | number | boolean>) => Promise<void>; names: Record<string, string> };
export function FocusPanel({ timers, participants, me, room, now, action, names }: Props) {
  const [minutes, setMinutes] = useState(25); const [rest, setRest] = useState(5); const [shared, setShared] = useState(false); const [busy, setBusy] = useState(false);
  const run = async (name: string, payload: Record<string, string | number | boolean> = {}) => { setBusy(true); try { await action(name, payload); } finally { setBusy(false); } };
  const personal = timers.filter(t => t.room_key === null && t.host_id === me).slice(-1);
  const visible = [...personal, ...timers.filter(t => t.room_key === room && t.state !== 'complete')];
  return <section className="space-y-4" aria-label="Focus timers">
    <h2 className="flex items-center gap-2 font-display text-xl"><Timer className="h-5 w-5" />Focus</h2>
    <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setMinutes(25); setRest(5); }}>25 / 5</Button><Button size="sm" variant="outline" onClick={() => { setMinutes(50); setRest(10); }}>50 / 10</Button></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Focus minutes<Input type="number" min={1} max={240} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><label className="text-sm">Break minutes<Input type="number" min={0} max={60} value={rest} onChange={e => setRest(Number(e.target.value))} /></label></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />Shared room session</label>
    <Button disabled={busy || (shared && (!room || room === 'hallway')) || minutes < 1 || minutes > 240 || rest < 0 || rest > 60} onClick={() => void run('start', { seconds: minutes * 60, break: rest * 60, shared })}><Play className="h-4 w-4" />Start focus</Button>
    {visible.map(t => { const r = timerReading(t, now); const joined = participants.some(p => p.session_id === t.id && p.user_id === me); return <div key={t.id} className="space-y-2 border-t pt-4">
      <div className="text-sm font-semibold">{t.room_key ? `Room focus · Host: ${names[t.host_id] ?? 'Member'}` : 'Personal focus'} · {r.phase}</div>
      <div className="font-mono text-3xl tabular-nums">{clock(r.remaining)}</div>
      <p className="text-sm text-muted-foreground">{r.complete ? 'Completed' : r.paused ? 'Paused' : 'Time remaining'} · Elapsed {clock(r.elapsed)}</p>
      {!r.complete && !r.paused && t.deadline && <p className="text-sm">{r.phase === 'focus' ? 'Focusing until' : 'Break until'} {new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
      <div className="flex flex-wrap gap-2">
        {t.host_id === me && <><Button size="icon" variant="outline" aria-label={r.paused ? 'Resume timer' : 'Pause timer'} title={r.paused ? 'Resume timer' : 'Pause timer'} disabled={busy || r.complete} onClick={() => void run(r.paused ? 'resume' : 'pause', { id: t.id })}>{r.paused ? <Play /> : <Pause />}</Button><Button size="icon" variant="outline" aria-label="Reset timer" title="Reset timer" disabled={busy} onClick={() => void run('reset', { id: t.id })}><RotateCcw /></Button></>}
        {t.room_key && <><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(joined ? 'leave_focus' : 'join', { id: t.id })}>{joined ? <LogOut className="h-4 w-4" /> : <Play className="h-4 w-4" />}{joined ? 'Leave session' : 'Join session'}</Button>{t.host_id !== me && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run('claim', { id: t.id })}>Take over absent host</Button>}</>}
      </div>
    </div>; })}
  </section>;
}