import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
export const getAudience = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ houseId: z.string().uuid(), room: z.enum(['bedroom1','bedroom2','lounge','kitchen']) }).strict().parse(d)).handler(async ({ data, context }) => {
  const current = await context.supabase.rpc('orbit_current', { _house: data.houseId, _user: context.userId, _room: data.room });
  if (current.error || current.data !== true) return { known: false, listeners: [] as string[], unauthorized: true };
  const url = process.env['LIVEKIT_URL'], key = process.env['LIVEKIT_API_KEY'], secret = process.env['LIVEKIT_API_SECRET'];
  if (!url || !key || !secret) return { known: false, listeners: [] as string[], unauthorized: false };
  const { RoomServiceClient } = await import('livekit-server-sdk');
  try {
    const provider = new RoomServiceClient(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), key, secret);
    const participants = await provider.listParticipants(`${data.houseId}:voice:${data.room}`);
    const { data: members, error } = await context.supabase.from('house_members').select('user_id,display_name').eq('house_id', data.houseId);
    if (error) return { known: false, listeners: [] as string[], unauthorized: false };
    // Provider-attested permission, not client publication/presence, determines who can hear.
    const listeners = participants.filter(p => p.permission?.canSubscribe && p.identity.split(':')[0] !== context.userId).map(p => members?.find(m => m.user_id === p.identity.split(':')[0])?.display_name ?? 'Connected participant');
    return { known: true, listeners, unauthorized: false };
  } catch { return { known: false, listeners: [] as string[], unauthorized: false }; }
});