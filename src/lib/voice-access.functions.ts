import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Reconcile durable revocations; identities are lease-specific, never user-wide. */
export const reconcileVoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ houseId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase.from("house_members").select("user_id").eq("house_id", data.houseId).eq("user_id", context.userId).maybeSingle();
    if (error || !member) throw new Error("House access denied");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leases, error: lookup } = await supabaseAdmin.from("voice_leases").select("*").eq("house_id", data.houseId).eq("removed", false);
    if (lookup) throw new Error("Could not verify voice access");
    const { data: activity, error: ae } = await context.supabase.from("house_activity").select("user_id,room_key,updated_at").eq("house_id", data.houseId);
    if (ae) throw new Error("Could not verify room access");
    const stale = (leases ?? []).filter((l) => l.revoked || Date.parse(l.expires_at) < Date.now() || !activity?.some((a) => a.user_id === l.user_id && a.room_key === l.room_key && Date.parse(a.updated_at) > Date.now() - 30000));
    if (!stale.length) return { ok: true };
    // Existing runtime configuration is referenced only inside this handler; values are never logged or returned.
    const url = process.env["LIVEKIT_URL"], key = process.env["LIVEKIT_API_KEY"], secret = process.env["LIVEKIT_API_SECRET"];
    if (!url || !key || !secret) return { ok: false };
    const { RoomServiceClient } = await import("livekit-server-sdk");
    const service = new RoomServiceClient(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), key, secret);
    for (const l of stale) {
      await supabaseAdmin.from("voice_leases").update({ revoked: true }).eq("id", l.id);
      try {
        await service.updateParticipant(`${l.house_id}:voice:${l.room_key}`, `${l.user_id}:${l.id}`, { permission: { canSubscribe: false, canPublish: false, canPublishData: false } });
        await service.removeParticipant(`${l.house_id}:voice:${l.room_key}`, `${l.user_id}:${l.id}`);
      }
      catch (e) { if (!(e instanceof Error && "status" in e && e.status === 404)) return { ok: false }; }
      const { error: update } = await supabaseAdmin.from("voice_leases").update({ removed: Date.parse(l.token_expires_at) < Date.now() }).eq("id", l.id);
      if (update) return { ok: false };
    }
    return { ok: true };
  });

export const checkVoiceLease = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ houseId: z.string().uuid(), leaseId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: lease, error } = await context.supabase.rpc("orbit_voice", { _house: data.houseId, _action: "check", _lease: data.leaseId });
    const result = z.object({ room_key: z.enum(["bedroom1", "bedroom2", "lounge", "kitchen"]) }).safeParse(lease);
    if (error || !result.success) return { ok: false };
    const url = process.env["LIVEKIT_URL"], key = process.env["LIVEKIT_API_KEY"], secret = process.env["LIVEKIT_API_SECRET"];
    if (!url || !key || !secret) return { ok: false };
    const { RoomServiceClient, TrackSource } = await import("livekit-server-sdk");
    try {
      await new RoomServiceClient(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), key, secret)
        .updateParticipant(`${data.houseId}:voice:${result.data.room_key}`, `${context.userId}:${data.leaseId}`, { permission: { canSubscribe: true, canPublish: true, canPublishData: false, canPublishSources: [TrackSource.MICROPHONE] } });
      // Check again after activation in case a door or room transition raced the request.
      const checked = await context.supabase.rpc("orbit_voice", { _house: data.houseId, _action: "check", _lease: data.leaseId });
      if (checked.error) {
        await new RoomServiceClient(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), key, secret).removeParticipant(`${data.houseId}:voice:${result.data.room_key}`, `${context.userId}:${data.leaseId}`);
        return { ok: false };
      }
      return { ok: true };
    } catch { return { ok: false }; }
  });