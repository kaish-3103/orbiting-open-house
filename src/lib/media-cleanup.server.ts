import { removeLease } from '@/lib/cleanup';
export async function cleanupMedia(houseId?: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const url = process.env['LIVEKIT_URL'], key = process.env['LIVEKIT_API_KEY'], secret = process.env['LIVEKIT_API_SECRET'];
  if (!url || !key || !secret) return { ok: false, reason: 'Media service is not configured' };
  const { RoomServiceClient } = await import('livekit-server-sdk');
  const provider = new RoomServiceClient(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), key, secret);
  let removed = 0, failed = 0;
  // Atomic claims share the house lock with renewals/transitions: a healthy renewed
  // lease cannot be removed based on an earlier snapshot. Failed claims rotate
  // behind unattempted rows, avoiding starvation by a fixed first page.
  for (let batch = 0; batch < 4; batch++) {
    const { data: leases, error } = await supabaseAdmin.rpc('orbit_claim_media_cleanup', { ...houseId ? { _house: houseId } : {}, _limit: 50 });
    if (error) throw new Error('Cleanup lookup failed');
    if (!leases?.length) break;
    await Promise.all(leases.map(async lease => {
      const room = `${lease.house_id}:${lease.media_kind}:${lease.room_key}`, identity = `${lease.user_id}:${lease.id}`;
      try {
        await removeLease(lease, { disable: () => provider.updateParticipant(room, identity, { permission: { canPublish: false, canSubscribe: false, canPublishData: false } }), remove: () => provider.removeParticipant(room, identity) }, async (done) => { const result = await supabaseAdmin.from('voice_leases').update({ removed: done }).eq('id', lease.id).eq('revoked', true); if (result.error) throw new Error('Cleanup persistence failed'); }, Date.now());
        removed++;
      } catch { failed++; }
    }));
    if (leases.length < 50) break;
  }
  return { ok: failed === 0, removed, failed };
}