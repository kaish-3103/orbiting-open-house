import { useCallback, useEffect, useRef, useState } from "react";
import type { Room, RemoteTrack, Track } from "livekit-client";
import { getLivekitToken, leaveVoiceRoom } from "@/lib/livekit.functions";
import { VOICE_ROOMS, type RoomKey } from "@/lib/house";

type Opts = { houseId: string; myRoom: RoomKey | null; autoVoice: boolean; micOn: boolean; camOn: boolean; allowedRooms: (r: RoomKey) => boolean };
export type MediaState = "loading" | "unconfigured" | "ready" | "error";

/**
 * Two LiveKit connections: a house-wide video room (camera only) that stays up while you move,
 * and one voice room for the room you're in. Voice is torn down (client + server) before joining another.
 */
export function useOrbitMedia({ houseId, myRoom, autoVoice, micOn, camOn, allowedRooms }: Opts) {
  const [state, setState] = useState<MediaState>("loading");
  const [videos, setVideos] = useState<Record<string, Track>>({});
  const [voiceRoom, setVoiceRoom] = useState<RoomKey | null>(null);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const videoRoom = useRef<Room | null>(null);
  const voice = useRef<{ room: Room; key: RoomKey } | null>(null);
  const gen = useRef(0);
  const micRef = useRef(micOn);
  micRef.current = micOn;

  // House-wide video connection
  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;
    (async () => {
      try {
        const res = await getLivekitToken({ data: { houseId, kind: "video" } });
        if (cancelled) return;
        if (!res.configured) { setState("unconfigured"); return; }
        const lk = await import("livekit-client");
        room = new lk.Room({ adaptiveStream: true, dynacast: true });
        const refresh = () => {
          const map: Record<string, Track> = {};
          room!.remoteParticipants.forEach((p) => {
            const pub = p.getTrackPublication(lk.Track.Source.Camera);
            if (pub?.track && !pub.isMuted) map[p.identity] = pub.track;
          });
          const lp = room!.localParticipant.getTrackPublication(lk.Track.Source.Camera);
          if (lp?.track && !lp.isMuted) map[room!.localParticipant.identity] = lp.track;
          setVideos(map);
        };
        room.on(lk.RoomEvent.TrackSubscribed, refresh).on(lk.RoomEvent.TrackUnsubscribed, refresh)
          .on(lk.RoomEvent.TrackMuted, refresh).on(lk.RoomEvent.TrackUnmuted, refresh)
          .on(lk.RoomEvent.LocalTrackPublished, refresh).on(lk.RoomEvent.LocalTrackUnpublished, refresh)
          .on(lk.RoomEvent.ParticipantDisconnected, refresh);
        await room.connect(res.url, res.token);
        if (cancelled) { room.disconnect(); return; }
        videoRoom.current = room;
        setState("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; room?.disconnect(); videoRoom.current = null; };
  }, [houseId]);

  // Camera toggle (only after the user asks; the browser prompts for permission)
  useEffect(() => {
    const r = videoRoom.current;
    if (!r || state !== "ready") return;
    r.localParticipant.setCameraEnabled(camOn).catch((e) => console.error(e));
  }, [camOn, state]);

  const leaveVoice = useCallback(async () => {
    const v = voice.current;
    voice.current = null;
    setVoiceRoom(null);
    setSpeakers([]);
    if (v) {
      await v.room.disconnect();
      leaveVoiceRoom({ data: { houseId, roomKey: v.key as "lounge" } }).catch(() => {});
    }
  }, [houseId]);

  // Room-scoped voice: leave old, then join new
  const target = state === "ready" && autoVoice && myRoom && VOICE_ROOMS.includes(myRoom) && allowedRooms(myRoom) ? myRoom : null;
  useEffect(() => {
    const my = ++gen.current;
    (async () => {
      if (voice.current?.key === target) return;
      await leaveVoice();
      if (!target || my !== gen.current) return;
      try {
        const res = await getLivekitToken({ data: { houseId, kind: "voice", roomKey: target as "lounge" } });
        if (!res.configured || my !== gen.current) return;
        const lk = await import("livekit-client");
        const room = new lk.Room();
        room.on(lk.RoomEvent.TrackSubscribed, (t: RemoteTrack) => {
          if (t.kind === "audio") { const el = t.attach(); el.dataset["orbitAudio"] = "1"; document.body.appendChild(el); }
        });
        room.on(lk.RoomEvent.TrackUnsubscribed, (t: RemoteTrack) => t.detach().forEach((el) => el.remove()));
        room.on(lk.RoomEvent.Disconnected, () => room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => pub.track?.detach().forEach((el) => el.remove()))));
        room.on(lk.RoomEvent.ActiveSpeakersChanged, (ps) => setSpeakers(ps.map((p) => p.identity)));
        await room.connect(res.url, res.token);
        if (my !== gen.current) { room.disconnect(); return; }
        voice.current = { room, key: target };
        setVoiceRoom(target);
        if (micRef.current) await room.localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [target, houseId, leaveVoice]);

  // Mic toggle inside the current voice room
  useEffect(() => {
    voice.current?.room.localParticipant.setMicrophoneEnabled(micOn).catch((e) => console.error(e));
  }, [micOn, voiceRoom]);

  useEffect(() => () => { gen.current++; void leaveVoice(); }, [leaveVoice]);

  return { state, videos, voiceRoom, speakers };
}
