import { expect, it, vi } from 'vitest';
import { MicrophoneController } from './microphone';
it('a delayed unmute cannot overtake a newer mute', async () => {
  let finish = () => {}; let published = false;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const set = vi.fn(async (enabled: boolean) => { if (enabled) await pending; published = enabled; });
  const mic = new MicrophoneController(set);
  const start = mic.set(true); await Promise.resolve();
  const mute = mic.set(false); finish(); await start; await mute;
  expect(published).toBe(false); expect(set.mock.calls.at(-1)).toEqual([false]);
});
it('failed microphone permission does not block an explicit retry', async () => {
  const set = vi.fn().mockRejectedValueOnce(Error('denied')).mockResolvedValue(undefined);
  const mic = new MicrophoneController(set);
  await expect(mic.set(true)).rejects.toThrow('denied'); await mic.set(true);
  expect(set).toHaveBeenCalledTimes(2);
});