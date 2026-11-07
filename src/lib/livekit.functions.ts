import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOICE = ["bedroom1", "bedroom2", "lounge", "kitchen"] as const;

const input = z.object({
  houseId: z.string().uuid(),
  kind: z.enum(["video", "voice"]),
  roomKey: z.enum(VOICE).optional(),
}).strict();

function cfg() {
  const url = process.env["LIVEKIT_URL"];
  const key = process.env["LIVEKIT_API_KEY"];
  const secret = process.env["LIVEKIT_API_SECRET"];
  return url && key && secret ? { url, key, secret } : null;
}

/** Issues a short-lived LiveKit token. Video = house-wide, camera only. Voice = one room, mic only, door rules enforced. */
export const getLivekitToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const c = cfg();
    if (!c) return { configured: false as const };
    const { supabase, userId } = context;

    const { data: member, error: memberError } = await supabase
      .from("house_members")
      .select("display_name")
      .eq("house_id", data.houseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError || !member) throw new Error("Not a member of this house");

    let lkRoom = `${data.houseId}:video`;
    let leaseId: string | undefined;
    if (data.kind === "voice") {
      if (!data.roomKey) throw new Error("roomKey required");
      const { data: lease, error } = await supabase.rpc("orbit_voice", { _house: data.houseId, _action: "reserve", _room: data.roomKey });
      const parsed = z.object({ id: z.string().uuid() }).safeParse(lease);
      if (error || !parsed.success) throw new Error("Voice requires your authorized current room");
      leaseId = parsed.data.id;
      lkRoom = `${data.houseId}:voice:${data.roomKey}`;
    }

    const { AccessToken, TrackSource } = await import("livekit-server-sdk");
    const at = new AccessToken(c.key, c.secret, {
      identity: leaseId ? `${userId}:${leaseId}` : userId,
      name: member.display_name,
      ttl: data.kind === "voice" ? "20s" : "10m",
    });
    at.addGrant({
      room: lkRoom,
      roomJoin: true,
      // Voice starts inert. The authenticated post-connect lease check activates it.
      // Replaying a stale token can join but cannot hear or publish anything.
      canSubscribe: data.kind === "video",
      canPublish: data.kind === "video",
      canPublishData: false,
      canPublishSources: [data.kind === "video" ? TrackSource.CAMERA : TrackSource.MICROPHONE],
    });
    return { configured: true as const, url: c.url, token: await at.toJwt(), room: lkRoom, leaseId };
  });

/** Server-side removal from a voice room so leaving is enforced, not just a client disconnect. */
export const leaveVoiceRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ houseId: z.string().uuid(), roomKey: z.enum(VOICE), leaseId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const c = cfg();
    if (!c) return { ok: false };
    const { data: lease, error } = await context.supabase.from("voice_leases").select("id,room_key,token_expires_at").eq("id", data.leaseId).eq("house_id", data.houseId).eq("user_id", context.userId).maybeSingle();
    if (error || !lease || lease.room_key !== data.roomKey) return { ok: false };
    const { error: revokeError } = await context.supabase.rpc("orbit_voice", { _house: data.houseId, _action: "revoke", _lease: data.leaseId });
    if (revokeError) return { ok: false };
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const host = c.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      const service = new RoomServiceClient(host, c.key, c.secret);
      await service.updateParticipant(`${data.houseId}:voice:${data.roomKey}`, `${context.userId}:${data.leaseId}`, { permission: { canSubscribe: false, canPublish: false, canPublishData: false } });
      await service.removeParticipant(
        `${data.houseId}:voice:${data.roomKey}`,
        `${context.userId}:${data.leaseId}`,
      );
    } catch (error) {
      // Only an already-absent participant is a successful teardown. Other
      // failures must block rejoining with the same identity.
      if (!(error instanceof Error && "status" in error && error.status === 404)) return { ok: false };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: update } = await supabaseAdmin.from("voice_leases").update({ removed: Date.parse(lease.token_expires_at) < Date.now() }).eq("id", data.leaseId);
    return { ok: !update };
  });
