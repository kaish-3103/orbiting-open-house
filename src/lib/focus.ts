export type FocusTimer = { id: string; host_id: string; room_key: string | null; focus_seconds: number; break_seconds: number; phase: string; state: string; remaining_seconds: number; deadline: string | null };
export function timerReading(timer: FocusTimer, now: number) {
  let phase = timer.phase;
  let remaining = timer.state === 'running' && timer.deadline ? (Date.parse(timer.deadline) - now) / 1000 : timer.remaining_seconds;
  if (timer.state === 'running' && remaining <= 0 && phase === 'focus' && timer.break_seconds > 0) { remaining += timer.break_seconds; phase = 'break'; }
  const duration = phase === 'focus' ? timer.focus_seconds : timer.break_seconds;
  remaining = Math.max(0, Math.ceil(remaining));
  return { phase, remaining, elapsed: Math.max(0, duration - remaining), complete: timer.state === 'complete' || (timer.state === 'running' && remaining === 0), paused: timer.state === 'paused' };
}
export function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
export function visitDuration(start: string, now: number) { const minutes = Math.max(0, Math.floor((now - Date.parse(start)) / 60000)); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`; }