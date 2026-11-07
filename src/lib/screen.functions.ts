import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
const input = z.object({ houseId: z.string().uuid(), room: z.enum(['bedroom1','bedroom2','lounge','kitchen']), action: z.enum(['reserve','check','revoke']), share: z.boolean().default(false), leaseId: z.string().uuid().optional() }).strict();
export const screenAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc('orbit_screen', { _house: data.houseId, _action: data.action, _room: data.room, _share: data.share, ...(data.leaseId ? { _lease: data.leaseId } : {}) });
  const parsed = z.object({ id: z.string().uuid(), room_key: z.string(), is_sharer: z.boolean() }).safeParse(result.data);
  if (result.error || !parsed.success) throw new Error('Screen access denied or another person is sharing');
  const url = process.env['LIVEKIT_URL'], key = process.env['LIVEKIT_API_KEY'], secret = process.env['LIVEKIT_API_SECRET'];
  if (!url || !key || !secret) throw new Error('Screen service is not configured');
  const { AccessToken, RoomServiceClient, TrackSource } = await import('livekit-server-sdk');
  const room = `${data.houseId}:screen:${parsed.data.room_key}`, identity = `${context.userId}:${parsed.data.id}`;
  const service = new RoomServiceClient(url.replace(/^wss:/,'https:').replace(/^ws:/,'http:'), key, secret);
  if (data.action === 'reserve') {
    const token = new AccessToken(key, secret, { identity, ttl: '20s' }); token.addGrant({ room, roomJoin: true, canPublish: false, canSubscribe: false, canPublishData: false });
    return { token: await token.toJwt(), url, leaseId: parsed.data.id, ok: true };
  }
  if (data.action === 'check') {
    await service.updateParticipant(room, identity, { permission: { canSubscribe: true, canPublish: parsed.data.is_sharer, canPublishSources: parsed.data.is_sharer ? [TrackSource.SCREEN_SHARE] : [], canPublishData: false } });
    const recheck = await context.supabase.rpc('orbit_screen', { _house: data.houseId, _action: 'check', _lease: parsed.data.id });
    if (recheck.error) { await service.removeParticipant(room, identity); throw new Error('Screen permission changed'); }
  } else {
    try { await service.updateParticipant(room, identity, { permission: { canSubscribe: false, canPublish: false, canPublishData: false } }); await service.removeParticipant(room, identity); }
    catch (e) { if (!(e instanceof Error && 'status' in e && e.status === 404)) throw new Error('Screen removal delayed'); }
  }
  return { ok: true, token: undefined, url, leaseId: parsed.data.id };
});