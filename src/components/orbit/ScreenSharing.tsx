import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, createLocalScreenTracks, type LocalTrack } from 'livekit-client';
import { useServerFn } from '@tanstack/react-start';
import { Monitor, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { screenAccess } from '@/lib/screen.functions';
import { VoiceSession } from '@/lib/voice-session';
import { bounded } from '@/lib/async-operation';
import type { RoomKey } from '@/lib/house';
type ScreenKey = { room: 'bedroom1' | 'bedroom2' | 'lounge' | 'kitchen'; track?: LocalTrack };
export function ScreenSharing({ houseId, room }: { houseId: string; room: RoomKey | null }) {
  const access = useServerFn(screenAccess); const queue = useRef<VoiceSession<ScreenKey> | null>(null);
  const [sharing, setSharing] = useState(false); const [error, setError] = useState(''); const [remote, setRemote] = useState<Track | null>(null); const [busy, setBusy] = useState(false); const video = useRef<HTMLVideoElement>(null); const [mode, setMode] = useState<'off' | 'view' | 'share'>('off');
  useEffect(() => {
    let disposed = false;
    const controller = new VoiceSession<ScreenKey>(async (key, current) => {
      const response = await bounded(access({ data: { houseId, room: key.room, action: 'reserve', share: !!key.track } }), 'Screen connection timed out');
      if (!response.token) throw new Error('Screen connection unavailable');
      const connection = new Room(); let timer: ReturnType<typeof setInterval> | undefined;
      const disconnect = async () => { clearInterval(timer); key.track?.stop(); await connection.disconnect(); if (!disposed) { setRemote(null); setSharing(false); } };
      const remove = async () => { await access({ data: { houseId, room: key.room, action: 'revoke', leaseId: response.leaseId } }); };
      connection.on(RoomEvent.TrackSubscribed, track => { if (current() && !disposed && track.source === Track.Source.ScreenShare) setRemote(track); });
      connection.on(RoomEvent.TrackUnsubscribed, () => { if (current() && !disposed) setRemote(null); });
      connection.on(RoomEvent.Disconnected, () => { if (current() && !disposed) { setRemote(null); setSharing(false); setError('Screen disconnected. Stop and retry.'); } });
      connection.on(RoomEvent.Reconnecting, () => { if (!disposed) { setRemote(null); key.track?.stop(); setSharing(false); setMode('off'); } });
      try {
        await connection.connect(response.url, response.token, { websocketTimeout: 15000, peerConnectionTimeout: 15000 });
        await bounded(access({ data: { houseId, room: key.room, action: 'check', leaseId: response.leaseId } }), 'Screen permission timed out');
        if (!current() || disposed) return { key, disconnect, remove };
        if (key.track) { await connection.localParticipant.publishTrack(key.track, { source: Track.Source.ScreenShare }); key.track.mediaStreamTrack.onended = () => setMode('off'); setSharing(true); setRemote(key.track); }
        timer = setInterval(() => { void bounded(access({ data: { houseId, room: key.room, action: 'check', leaseId: response.leaseId } }), 'Screen permission timed out').catch(() => { key.track?.stop(); if (!disposed) { setRemote(null); setMode('off'); setError('Screen access revoked or disconnected.'); } }); }, 5000);
        return { key, disconnect, remove };
      } catch (failure) { return { key, disconnect, remove, failure }; }
    }); queue.current = controller;
    return () => { disposed = true; queue.current = null; void controller.switchTo(null, () => {}); };
  }, [houseId]);
  useEffect(() => { setMode('off'); setRemote(null); setSharing(false); void queue.current?.switchTo(null, () => {}); }, [room]);
  useEffect(() => { if (mode === 'off') void queue.current?.switchTo(null, (_, e) => { setBusy(false); if (e) setError('Screen removal is retrying.'); }); }, [mode]);
  useEffect(() => { if (!remote || !video.current) return; const el = video.current; remote.attach(el); return () => { remote.detach(el); el.srcObject = null; }; }, [remote]);
  async function start(share: boolean) {
    if (!room || room === 'hallway' || busy) return;
    setBusy(true); setError('');
    try {
      const tracks = share ? await createLocalScreenTracks({ audio: false }) : [];
      const track = tracks[0]; if (share && !track) throw new Error('No screen selected');
      setMode(share ? 'share' : 'view');
      await queue.current?.switchTo({ room, ...(track ? { track } : {}) }, (_, e) => { setBusy(false); if (e) { track?.stop(); setError('Screen could not connect. Stop and retry.'); } });
    } catch { setBusy(false); setMode('off'); setError('Screen chooser cancelled or permission denied.'); }
  }
  return <><div className="flex flex-wrap justify-center gap-2 border-t bg-card px-3 py-1"><Button size="sm" variant="ghost" disabled={!room || room === 'hallway' || busy} onClick={() => void start(false)}><Monitor className="h-4 w-4" />View room screen</Button><Button size="sm" variant="ghost" disabled={!room || room === 'hallway' || busy} onClick={() => void start(true)}><Monitor className="h-4 w-4" />Share screen</Button>{mode !== 'off' && <Button size="sm" variant="outline" onClick={() => setMode('off')}><MonitorOff className="h-4 w-4" />{sharing ? 'Stop sharing' : 'Stop viewing'}</Button>}</div>{error && <p role="alert" className="bg-card px-3 text-center text-xs text-destructive">{error}</p>}{remote && <div className="absolute right-4 bottom-52 z-20 w-72 max-w-[90vw] border bg-card p-2 shadow-float"><p className="mb-1 text-xs">{sharing ? 'Your screen' : 'Room screen'} · Authorized room viewers only · No recording</p><video ref={video} autoPlay playsInline muted className="aspect-video w-full object-contain" /></div>}</>;
}