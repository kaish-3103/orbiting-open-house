import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";

export function AvatarVideo({ track, isMe }: { track: Track; isMe?: boolean | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); el.srcObject = null; };
  }, [track]);
  return <foreignObject x={-19} y={-19} width={38} height={38}>
    <div className="h-full w-full overflow-hidden rounded-full">
      <video ref={ref} autoPlay playsInline muted className={`h-full w-full object-cover ${isMe ? "-scale-x-100" : ""}`} />
    </div>
  </foreignObject>;
}