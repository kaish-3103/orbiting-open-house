import { useEffect, useRef, useState } from "react";
import * as lk from "livekit-client";
import type { Room, RemoteTrack, Track } from "livekit-client";
import { getLivekitToken, leaveVoiceRoom } from "@/lib/livekit.functions";
import { VOICE_ROOMS, type RoomKey } from "@/lib/house";
import { bounded } from "@/lib/async-operation";
import { VoiceSession } from "@/lib/voice-session";
import { checkVoiceLease } from "@/lib/voice-access.functions";
import { useServerFn } from "@tanstack/react-start";
import { MicrophoneController } from '@/lib/microphone';

type Opts = { houseId: string; enabled?: boolean; myRoom: RoomKey | null; autoVoice: boolean; micOn: boolean; camOn: boolean; allowedRooms: (r: RoomKey) => boolean; onCameraFailed: () => void; onMicFailed: () => void };
export type MediaState = "loading" | "unconfigured" | "ready" | "error";
export function useOrbitMedia({ houseId, enabled = true, myRoom, autoVoice, micOn, camOn, allowedRooms, onCameraFailed, onMicFailed }: Opts) {
  const [state, setState] = useState<MediaState>("loading");
  const [videos, setVideos] = useState<Record<string, Track>>({});
  const [voiceRoom, setVoiceRoom] = useState<RoomKey | null>(null);
  const [voiceState, setVoiceState] = useState<"off" | "connecting" | "connected" | "error">("off");
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [cameraPublished, setCameraPublished] = useState(false);
  const [micPublished, setMicPublished] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [errors, setErrors] = useState<{ camera?: string | undefined; mic?: string | undefined; voice?: string | undefined; connection?: string | undefined }>({});
  const [videoRetryId, setVideoRetryId] = useState(0);
  const [voiceRetryId, setVoiceRetryId] = useState(0);
  const tokenFn = useServerFn(getLivekitToken);
  const leaveFn = useServerFn(leaveVoiceRoom);
  const checkFn = useServerFn(checkVoiceLease);
  const videoRoom = useRef<Room | null>(null);
  const voice = useRef<Room | null>(null);
  const session = useRef<VoiceSession<RoomKey> | null>(null);
  const microphones = useRef(new WeakMap<Room, MicrophoneController>());
  const micController = (room: Room) => {
    let controller = microphones.current.get(room);
    if (!controller) { controller = new MicrophoneController(on => room.localParticipant.setMicrophoneEnabled(on)); microphones.current.set(room, controller); }
    return controller;
  };
  const callbacks = useRef({ onCameraFailed, onMicFailed });
  callbacks.current = { onCameraFailed, onMicFailed };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let room: Room | null = null;
    setState("loading");
    setErrors((e) => ({ ...e, connection: undefined }));
    (async () => {
      try {
        const res = await bounded(tokenFn({ data: { houseId, kind: "video" } }), "Video connection timed out");
        if (cancelled) return;
        if (!res.configured) { setState("unconfigured"); return; }
        const connection = new lk.Room({ adaptiveStream: true, dynacast: true });
        room = connection;
        const refresh = () => {
          if (cancelled) return;
          const map: Record<string, Track> = {};
          connection.remoteParticipants.forEach((p) => {
            const pub = p.getTrackPublication(lk.Track.Source.Camera);
            if (pub?.track && !pub.isMuted) map[p.identity] = pub.track;
          });
          const pub = connection.localParticipant.getTrackPublication(lk.Track.Source.Camera);
          const published = !!pub?.track && !pub.isMuted;
          if (pub?.track && published) map[connection.localParticipant.identity] = pub.track;
          setCameraPublished(published);
          setVideos(map);
        };
        connection.on(lk.RoomEvent.TrackSubscribed, refresh).on(lk.RoomEvent.TrackUnsubscribed, refresh)
          .on(lk.RoomEvent.TrackMuted, refresh).on(lk.RoomEvent.TrackUnmuted, refresh)
          .on(lk.RoomEvent.LocalTrackPublished, refresh).on(lk.RoomEvent.LocalTrackUnpublished, refresh)
          .on(lk.RoomEvent.ParticipantDisconnected, refresh)
          .on(lk.RoomEvent.Reconnecting, () => { if (!cancelled) { setCameraPublished(false); setState("loading"); } })
          .on(lk.RoomEvent.Reconnected, () => { if (!cancelled) { setState("ready"); refresh(); } })
          .on(lk.RoomEvent.Disconnected, () => {
            if (cancelled) return;
            setVideos({}); setCameraPublished(false); setState("error");
            setErrors((e) => ({ ...e, connection: "Video disconnected. Retry the connection." }));
          });
        await connection.connect(res.url, res.token, { websocketTimeout: 15000, peerConnectionTimeout: 15000 });
        if (cancelled) { await connection.disconnect(); return; }
        videoRoom.current = connection;
        setState("ready"); refresh();
      } catch {
        await room?.disconnect();
        if (!cancelled) { setState("error"); setErrors((e) => ({ ...e, connection: "Couldn't connect video. Check your connection and retry." })); }
      }
    })();
    return () => { cancelled = true; void room?.disconnect(); videoRoom.current = null; };
  }, [houseId, videoRetryId, enabled]);

  useEffect(() => {
    let disposed = false;
    const controller = new VoiceSession<RoomKey>(async (key, current) => {
      const res = await bounded(tokenFn({ data: { houseId, kind: "voice", roomKey: key as "lounge" } }), "Voice connection timed out");
      if (!res.configured || !res.leaseId) throw new Error("Voice unavailable");
      const room = new lk.Room();
      const audio = new Set<HTMLMediaElement>();
      let leaseTimer: ReturnType<typeof setInterval> | undefined;
      const cleanup = () => {
        clearInterval(leaseTimer);
        audio.forEach((el) => { el.pause(); el.srcObject = null; el.remove(); }); audio.clear();
        room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => pub.track?.detach().forEach((el) => el.remove())));
      };
      const remove = async () => {
        // Do not race server removal against a timer: a late removal could kick
        // a newly joined participant. The UI watchdog is bounded, the queue isn't.
        const result = await leaveFn({ data: { houseId, roomKey: key as "lounge", leaseId: res.leaseId } });
        if (!result.ok) throw new Error("Voice teardown failed");
      };
      const disconnect = async () => { cleanup(); await room.disconnect(); };
      room.on(lk.RoomEvent.TrackSubscribed, (t: RemoteTrack) => {
        if (t.kind === "audio" && current() && !disposed) {
          const el = t.attach(); audio.add(el); document.body.appendChild(el);
          el.play().catch(() => { if (!disposed) setErrors((e) => ({ ...e, voice: "Audio playback was blocked. Retry voice." })); });
        }
      });
      room.on(lk.RoomEvent.TrackUnsubscribed, (t: RemoteTrack) => t.detach().forEach((el) => { audio.delete(el); el.remove(); }));
      room.on(lk.RoomEvent.Disconnected, () => {
        cleanup();
        if (!disposed && current()) { voice.current = null; setVoiceRoom(null); setMicPublished(false); setSpeakers([]); setVoiceState("error"); setErrors((e) => ({ ...e, voice: "Voice disconnected. Retry voice." })); }
      });
      room.on(lk.RoomEvent.ActiveSpeakersChanged, (ps) => { if (!disposed && current()) setSpeakers(ps.map((p) => p.identity.split(":")[0] ?? p.identity)); });
      room.on(lk.RoomEvent.Reconnecting, () => { if (!disposed && current()) { setVoiceRoom(null); setMicPublished(false); setVoiceState("connecting"); callbacks.current.onMicFailed(); } });
      room.on(lk.RoomEvent.Reconnected, () => {
        void bounded(checkFn({ data: { houseId, leaseId: res.leaseId } }), "Voice permission timed out").then(async (result) => {
          if (!result.ok || !current() || disposed) { await disconnect(); await remove(); return; }
          await micController(room).set(false);
          setMicPublished(false); setVoiceRoom(key); setVoiceState("connected");
        }).catch(() => { void disconnect(); void remove(); });
      });
      const refreshMic = () => { if (!disposed && current()) setMicPublished(room.localParticipant.isMicrophoneEnabled); };
      room.on(lk.RoomEvent.LocalTrackPublished, refreshMic).on(lk.RoomEvent.LocalTrackUnpublished, refreshMic)
        .on(lk.RoomEvent.TrackMuted, refreshMic).on(lk.RoomEvent.TrackUnmuted, refreshMic);
      try {
        await room.connect(res.url, res.token, { websocketTimeout: 15000, peerConnectionTimeout: 15000 });
        const check = await bounded(checkFn({ data: { houseId, leaseId: res.leaseId } }), "Voice permission timed out");
        if (!check.ok) throw new Error("Voice permission revoked");
        leaseTimer = setInterval(() => {
          void bounded(checkFn({ data: { houseId, leaseId: res.leaseId } }), "Voice permission timed out").then((result) => {
            if (!result.ok) { void disconnect(); void remove(); }
          }).catch(() => { void disconnect(); void remove(); });
        }, 5000);
      } catch (error) {
        // Preserve a cleanup handle even on connect failure so retries cannot race removal.
        return { key, disconnect, remove, failure: error };
      }
      if (current() && !disposed) voice.current = room;
      return { key, disconnect, remove };
    });
    session.current = controller;
    return () => { disposed = true; session.current = null; voice.current = null; void controller.switchTo(null, () => {}); };
  }, [houseId]);

  const target = enabled && autoVoice && myRoom && VOICE_ROOMS.includes(myRoom) && allowedRooms(myRoom) ? myRoom : null;
  useEffect(() => {
    let cancelled = false;
    setVoiceRoom(null); setSpeakers([]); setMicPublished(false); voice.current = null;
    setMicBusy(false);
    setVoiceState(target ? "connecting" : "off");
    setErrors((e) => ({ ...e, voice: undefined }));
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setVoiceState("error");
      setErrors((e) => ({ ...e, voice: "Voice is taking too long. Retry; the previous connection must finish closing first." }));
    }, 20000);
    void session.current?.switchTo(target, (key, error) => {
      if (cancelled) return;
      if (key || error || !target) clearTimeout(watchdog);
      setVoiceRoom(key);
      setVoiceState(error ? "error" : key ? "connected" : target ? "connecting" : "off");
      if (error) setErrors((e) => ({ ...e, voice: "Couldn't connect voice. Check your connection and retry." }));
    });
    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [target, voiceRetryId]);

  useEffect(() => {
    const room = videoRoom.current;
    if (!room || state !== "ready") return;
    let cancelled = false;
    let failed = false;
    setCameraBusy(true);
    if (camOn) setErrors((e) => ({ ...e, camera: undefined }));
    const operation = room.localParticipant.setCameraEnabled(camOn);
    operation.then(() => { if (failed) void room.localParticipant.setCameraEnabled(false).catch(() => {}); }, () => {});
    bounded(operation, "Camera timed out").then(() => {
      if (!cancelled) setCameraPublished(room.localParticipant.isCameraEnabled);
    }).catch(() => {
      failed = true;
      if (!cancelled) { setCameraPublished(false); callbacks.current.onCameraFailed(); setErrors((e) => ({ ...e, camera: "Camera couldn't start. Check browser permission and try Camera again." })); }
      void room.localParticipant.setCameraEnabled(false).catch(() => {});
    }).finally(() => { if (!cancelled) setCameraBusy(false); });
    return () => { cancelled = true; };
  }, [camOn, state]);

  useEffect(() => {
    const room = voice.current;
    if (!room || !voiceRoom) return;
    let cancelled = false;
    let failed = false;
    setMicBusy(true);
    if (micOn) setErrors((e) => ({ ...e, mic: undefined }));
    const controller = micController(room);
    const operation = controller.set(micOn);
    operation.then(() => { if (failed) void controller.set(false).catch(() => {}); }, () => {});
    bounded(operation, "Microphone timed out").then(() => {
      if (!cancelled) setMicPublished(room.localParticipant.isMicrophoneEnabled);
    }).catch(() => {
      failed = true;
      if (!cancelled) { setMicPublished(false); callbacks.current.onMicFailed(); setErrors((e) => ({ ...e, mic: "Microphone couldn't start. Check browser permission and try Mic again." })); }
      void controller.set(false).catch(() => {});
    }).finally(() => { if (!cancelled) setMicBusy(false); });
    return () => { cancelled = true; };
  }, [micOn, voiceRoom]);

  return { state, videos, voiceRoom, voiceState, speakers, cameraPublished, micPublished, cameraBusy, micBusy, errors, retryVoice: () => { callbacks.current.onMicFailed(); setVoiceRetryId((n) => n + 1); }, retryVideo: () => setVideoRetryId((n) => n + 1) };
}
