import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getAudience } from '@/lib/audience.functions';
import { bounded } from '@/lib/async-operation';
import type { RoomKey } from '@/lib/house';
export function Audience({ houseId, room, connected, mic, voiceOn }: { houseId: string; room: RoomKey | null; connected: boolean; mic: boolean; voiceOn: boolean }) {
  const get = useServerFn(getAudience); const [audience, setAudience] = useState<{ known: boolean; listeners: string[] }>({ known: false, listeners: [] });
  useEffect(() => { let disposed = false; setAudience({ known: false, listeners: [] }); if (!room || room === 'hallway' || !connected) return; const refresh = async () => { try { const result = await bounded(get({ data: { houseId, room } }), 'Audience unknown', 8000); if (!disposed) setAudience(result); } catch { if (!disposed) setAudience({ known: false, listeners: [] }); } }; void refresh(); const poll = setInterval(() => void refresh(), 5000); return () => { disposed = true; clearInterval(poll); }; }, [houseId, room, connected]);
  return <div className="border-t bg-card px-4 py-1 text-center text-xs text-muted-foreground" aria-live="polite">Camera: house-wide, opt-in · Screens: authorized room viewers only · Voice: {!voiceOn ? 'off' : !connected ? 'audience unknown / connecting or disconnected' : !mic ? 'muted' : 'mic live'}{connected && (audience.known ? ` · Connected listeners: ${audience.listeners.length ? audience.listeners.join(', ') : 'none verified at last check'}` : ' · Listener audience unknown / verifying')}</div>;
}