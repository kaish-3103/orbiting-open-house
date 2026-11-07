import { staleLease, removeLease } from '@/lib/cleanup';
export async function cleanupMedia() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const url = process.env['LIVEKIT_URL'], key = process.env['LIVEKIT_API_KEY'], secret = process.env['LIVEKIT_API_SECRET'];
  if (!url || !key || !secret) return { ok: false, reason: 'Media service is not configured' };
  const { RoomServiceClient } = await import('livekit-server-sdk');
  const provider = new RoomServiceClient(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), key, secret);
  const { data: leases, error } = await supabaseAdmin.from('voice_leases').select('*').eq('removed', false).limit(200);
  if (error) throw new Error('Cleanup lookup failed');
  let removed = 0, failed = 0;
  for (const lease of leases ?? []) {
    const { data: authorized, error: permissionError } = await supabaseAdmin.rpc('orbit_current', { _house: lease.house_id, _user: lease.user_id, _room: lease.room_key });
    if (!staleLease(lease, !permissionError && authorized === true, Date.now())) continue;
    const revoked = await supabaseAdmin.from('voice_leases').update({ revoked: true }).eq('id', lease.id);
    if (revoked.error) { failed++; continue; }
    const room = `${lease.house_id}:${lease.media_kind}:${lease.room_key}`, identity = `${lease.user_id}:${lease.id}`;
    try {
      await removeLease(lease, { disable: () => provider.updateParticipant(room, identity, { permission: { canPublish: false, canSubscribe: false, canPublishData: false } }), remove: () => provider.removeParticipant(room, identity) }, async (done) => { const result = await supabaseAdmin.from('voice_leases').update({ removed: done }).eq('id', lease.id); if (result.error) throw new Error('Cleanup persistence failed'); }, Date.now());
      removed++;
    } catch { failed++; }
  }
  return { ok: failed === 0, removed, failed };
}