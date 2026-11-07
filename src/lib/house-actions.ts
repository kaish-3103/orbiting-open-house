import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const activitySchema = z.object({ house_id: z.string().uuid(), user_id: z.string().uuid(), x: z.number().finite().min(40).max(1160), y: z.number().finite().min(40).max(740), room_key: z.enum(["bedroom1", "bedroom2", "hallway", "lounge", "kitchen"]).nullable(), path: z.array(z.object({ x: z.number().finite().min(40).max(1160), y: z.number().finite().min(40).max(740) }).strict()).max(5), motion_id: z.string().uuid(), status: z.enum(["available", "working", "dnd", "away"]), cam: z.boolean(), mic: z.boolean(), updated_at: z.string() });
export const knockSchema = z.object({ id: z.string().uuid(), house_id: z.string().uuid(), sender_id: z.string().uuid(), owner_id: z.string().uuid(), room_key: z.enum(["bedroom1", "bedroom2"]), decision: z.enum(["pending", "allowed", "denied"]), created_at: z.string() });
export async function houseAction(houseId: string, action: string, payload: Record<string, string | number | boolean> = {}) {
  const { data, error } = await supabase.rpc("orbit_action", { _house: houseId, _action: action, _payload: payload });
  if (error) throw new Error(error.message);
  return data;
}