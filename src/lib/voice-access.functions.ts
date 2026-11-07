import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Reconcile durable revocations; identities are lease-specific, never user-wide. */
export const reconcileVoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ houseId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase.from("house_members").select("user_id").eq("house_id", data.houseId).eq("user_id", context.userId).maybeSingle();
    if (error || !member) throw new Error("House access denied");
    const { cleanupMedia } = await import('@/lib/media-cleanup.server');
    return cleanupMedia(data.houseId);
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