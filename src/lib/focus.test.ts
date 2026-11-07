import { describe, expect, it } from 'vitest';
import { timerReading, visitDuration, type FocusTimer } from './focus';
const timer: FocusTimer = { id: '1', host_id: 'host', room_key: 'lounge', focus_seconds: 1500, break_seconds: 300, phase: 'focus', state: 'running', remaining_seconds: 1500, deadline: new Date(1500000).toISOString() };
describe('authoritative countdown', () => {
  it('25/5 uses the same deadline for late joins and background tabs', () => { expect(timerReading(timer, 600000).remaining).toBe(900); expect(timerReading(timer, 1501000)).toMatchObject({ phase: 'break', remaining: 299 }); expect(timerReading(timer, 1800000).complete).toBe(true); });
  it('50/10 has 3000 focus seconds and 600 break seconds', () => { const t = { ...timer, focus_seconds: 3000, break_seconds: 600, deadline: new Date(3000000).toISOString() }; expect(timerReading(t, 0).remaining).toBe(3000); expect(timerReading(t, 3000000).remaining).toBe(600); });
  it('pause does not accumulate ticks after refresh', () => { expect(timerReading({ ...timer, state: 'paused', deadline: null, remaining_seconds: 700 }, 99999999)).toMatchObject({ remaining: 700, elapsed: 800, paused: true }); });
  it('visit duration is elapsed since visit timestamp, not working time', () => { expect(visitDuration(new Date(0).toISOString(), 3900000)).toBe('1 hr 5 min'); });
});