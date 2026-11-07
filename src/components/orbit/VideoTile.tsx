import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { ROOMS, STATUS_LABEL, type RoomKey, type Status } from "@/lib/house";

type P = { uid: string; name: string; color: string; status: Status; room: RoomKey | null; cam: boolean; mic: boolean; voice: boolean };

export function VideoTile({ presence: p, track, isMe, speaking }: { presence: P; track?: Track | undefined; isMe: boolean; speaking: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!track || !ref.current) return;
    track.attach(ref.current);
    const el = ref.current;
    return () => { track.detach(el); };
  }, [track]);
  return (
    <div className={`overflow-hidden rounded-2xl border bg-background ${speaking ? "ring-2 ring-live" : ""}`}>
      <div className="relative aspect-video bg-muted">
        {track ? (
          <video ref={ref} autoPlay muted playsInline className={`h-full w-full object-cover ${isMe ? "-scale-x-100" : ""}`} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full font-display text-lg" style={{ background: `var(--${p.color})` }}>{p.name[0]}</div>
          </div>
        )}
        {track && isMe && <span className="absolute top-2 left-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">● LIVE</span>}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <div className="min-w-0">
          <div className="truncate font-semibold">{p.name}{isMe ? " (you)" : ""}</div>
          <div className="text-muted-foreground">{p.room ? ROOMS[p.room].label : "—"} · {STATUS_LABEL[p.status]}</div>
        </div>
        {p.mic && p.voice ? <Mic className="h-4 w-4 text-live" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}
