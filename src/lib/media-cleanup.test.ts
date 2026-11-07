import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), disable: vi.fn(), remove: vi.fn(), update: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('livekit-server-sdk', () => ({ RoomServiceClient: class { updateParticipant = mocks.disable; removeParticipant = mocks.remove; } }));
import { cleanupMedia } from './media-cleanup.server';
const lease = { id: 'old-lease', house_id: 'house', user_id: 'user', room_key: 'lounge', expires_at: new Date(0).toISOString(), token_expires_at: new Date(0).toISOString(), revoked: true, removed: false, media_kind: 'voice' };
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetAllMocks();
  // Dummy test-only configuration, never read actual configured credentials.
  vi.stubEnv('LIVEKIT_URL', 'https://media.invalid'); vi.stubEnv('LIVEKIT_API_KEY', 'dummy'); vi.stubEnv('LIVEKIT_API_SECRET', 'dummy');
  const chain = { eq: vi.fn() };
  chain.eq.mockReturnValueOnce(chain).mockResolvedValue({ error: null });
  mocks.update.mockReturnValue(chain); mocks.from.mockReturnValue({ update: mocks.update });
});
it('only atomically claimed old identity is removed, not a newer room session', async () => {
  mocks.rpc.mockResolvedValue({ data: [lease], error: null });
  expect((await cleanupMedia('house')).ok).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith('orbit_claim_media_cleanup', { _house: 'house', _limit: 50 });
  expect(mocks.disable).toHaveBeenCalledWith('house:voice:lounge', 'user:old-lease', expect.any(Object));
  expect(mocks.remove).toHaveBeenCalledWith('house:voice:lounge', 'user:old-lease');
  expect(mocks.remove).not.toHaveBeenCalledWith('house:voice:lounge', 'user:new-lease');
});
it('failed atomic claim never calls provider', async () => {
  mocks.rpc.mockResolvedValue({ error: Error('database down') });
  await expect(cleanupMedia()).rejects.toThrow('Cleanup lookup failed');
  expect(mocks.disable).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});
it('failed removal remains retryable without blocking later batches', async () => {
  mocks.rpc.mockResolvedValue({ data: [lease], error: null }); mocks.remove.mockRejectedValue(Error('offline'));
  expect(await cleanupMedia()).toEqual({ ok: false, removed: 0, failed: 1 });
  expect(mocks.update).not.toHaveBeenCalled();
});
it('drains further claimed batches and uses screen-specific identity', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => ({ ...lease, id: `old-${i}` })), error: null }).mockResolvedValueOnce({ data: [{ ...lease, media_kind: 'screen' }], error: null });
  mocks.from.mockReturnValue({ update: () => { const chain = { eq: vi.fn() }; chain.eq.mockReturnValueOnce(chain).mockResolvedValue({ error: null }); return chain; } });
  expect(await cleanupMedia()).toEqual({ ok: true, removed: 51, failed: 0 });
  expect(mocks.rpc).toHaveBeenCalledTimes(2); expect(mocks.remove).toHaveBeenCalledWith('house:screen:lounge', 'user:old-lease');
});