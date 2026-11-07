import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOICE = ["bedroom1", "bedroom2", "lounge", "kitchen"] as const;

const input = z.object({
  houseId: z.string().uuid(),
  kind: z.enum(["video", "voice"]),
  roomKey: z.enum(VOICE).optional(),
});

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

    const { data: member } = await supabase
      .from("house_members")
      .select("display_name")
      .eq("house_id", data.houseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("Not a member of this house");

    let lkRoom = `${data.houseId}:video`;
    if (data.kind === "voice") {
      if (!data.roomKey) throw new Error("roomKey required");
      if (data.roomKey === "bedroom1" || data.roomKey === "bedroom2") {
        const { data: door } = await supabase
          .from("room_doors")
          .select("owner_id,state")
          .eq("house_id", data.houseId)
          .eq("room_key", data.roomKey)
          .maybeSingle();
        if (door && door.owner_id !== userId && door.state !== "open") {
          if (door.state === "locked") throw new Error("Room is locked");
          const { data: grant } = await supabase
            .from("door_grants")
            .select("user_id")
            .eq("house_id", data.houseId)
            .eq("room_key", data.roomKey)
            .eq("user_id", userId)
            .maybeSingle();
          if (!grant) throw new Error("Knock first");
        }
      }
      lkRoom = `${data.houseId}:voice:${data.roomKey}`;
    }

    const { AccessToken, TrackSource } = await import("livekit-server-sdk");
    const at = new AccessToken(c.key, c.secret, {
      identity: userId,
      name: member.display_name,
      ttl: "10m",
    });
    at.addGrant({
      room: lkRoom,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
      canPublishSources: [data.kind === "video" ? TrackSource.CAMERA : TrackSource.MICROPHONE],
    });
    return { configured: true as const, url: c.url, token: await at.toJwt(), room: lkRoom };
  });

/** Server-side removal from a voice room so leaving is enforced, not just a client disconnect. */
export const leaveVoiceRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ houseId: z.string().uuid(), roomKey: z.enum(VOICE) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = cfg();
    if (!c) return { ok: false };
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const host = c.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      await new RoomServiceClient(host, c.key, c.secret).removeParticipant(
        `${data.houseId}:voice:${data.roomKey}`,
        context.userId,
      );
    } catch (error) {
      // Only an already-absent participant is a successful teardown. Other
      // failures must block rejoining with the same identity.
      if (!(error instanceof Error && "status" in error && error.status === 404)) return { ok: false };
    }
    return { ok: true };
  });
