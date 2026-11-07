import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { bounded } from '@/lib/async-operation';
const timer = z.object({ id: z.string(), host_id: z.string(), room_key: z.string().nullable(), focus_seconds: z.number(), break_seconds: z.number(), phase: z.string(), state: z.string(), remaining_seconds: z.number(), deadline: z.string().nullable() });
export const snapshotSchema = z.object({ now: z.string(), visits: z.array(z.object({ user_id: z.string(), started_at: z.string(), ended_at: z.string().nullable(), remembered: z.boolean() })), timers: z.array(timer), participants: z.array(z.object({ session_id: z.string(), user_id: z.string() })), signals: z.array(z.object({ id: z.string(), sender_id: z.string(), kind: z.string(), room_key: z.string().nullable() })), settings: z.array(z.object({ room_key: z.string(), name: z.string(), palette: z.string(), decor: z.string() })), messages: z.array(z.object({ id: z.string(), sender_id: z.string(), body: z.string(), room_key: z.string(), created_at: z.string() })) });
export type Experience = z.infer<typeof snapshotSchema>;
export async function experienceAction(houseId: string, action: string, payload: Record<string, string | number | boolean> = {}) {
  const { data, error } = await bounded(supabase.rpc('orbit_experience', { _house: houseId, _action: action, _payload: payload }), 'Connection delayed. Please retry.');
  if (error) throw new Error(error.message);
  return data;
}