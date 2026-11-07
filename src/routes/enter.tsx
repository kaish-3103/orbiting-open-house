import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/orbit/Logo";
import { supabase } from '@/integrations/supabase/client';
import { ensureGuest } from '@/lib/guest';
import { experienceAction } from '@/lib/experience';

export const Route = createFileRoute("/enter")({
  head: () => ({ meta: [
    { title: "Create or join a house — Orbit" },
    { name: "description", content: "Create a new Orbit house or join your friends with their house code." },
    { property: "og:title", content: "Enter your Orbit house" },
    { property: "og:description", content: "Create a house or join with a shared code." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Enter,
});

function Enter() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void (async () => { try { const uid = await ensureGuest(); const { data: visits, error: ve } = await supabase.from('house_visits').select('house_id').eq('user_id', uid).eq('remembered', true); if (ve) throw ve; const ids = visits?.map(v => v.house_id) ?? []; if (!ids.length) return; const { data, error: he } = await supabase.from('houses').select('id,name').in('id', ids); if (he) throw he; setRecent(data ?? []); } catch { setError('Recent houses unavailable. You can still join with a code.'); } })(); }, []);
  async function reenter(id: string) { const uid = await ensureGuest(); const { data, error } = await supabase.from('house_members').select('user_id').eq('house_id', id).eq('user_id', uid).maybeSingle(); if (error || !data) { setError('Your membership could not be verified. Ask for a new house code.'); return; } await experienceAction(id, 'remember'); navigate({ to: '/house/$houseId', params: { houseId: id } }); }
  return <div className="min-h-screen bg-background bg-glow">
    <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
    <main className="mx-auto max-w-lg space-y-8 px-6 pt-10">
      <h1 className="text-4xl font-semibold">Enter Orbit</h1>
      <Button asChild className="rounded-full"><Link to="/create">Make a new house</Link></Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {recent.length > 0 && <section className="space-y-3 border-t pt-6"><h2 className="text-xl font-semibold">Your recent houses</h2>{recent.map(h => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2"><span>{h.name}</span><div className="flex gap-1"><Button size="sm" onClick={() => void reenter(h.id).catch(() => setError('Re-entry failed. Please retry.'))}>Re-enter</Button><Button size="sm" variant="ghost" onClick={() => void experienceAction(h.id, 'forget').then(() => setRecent(r => r.filter(x => x.id !== h.id))).catch(() => setError('Could not forget this house. Retry.'))}>Forget</Button></div></div>)}<p className="text-sm text-muted-foreground">Guest identity lives in this browser. Clearing storage loses remembered houses and may require a new house code.</p></section>}
      <form className="space-y-4 border-t pt-6" onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate({ to: "/join/$token", params: { token: code.trim().toLowerCase() } }); }}>
        <h2 className="text-xl font-semibold">Join with a code</h2>
        <Input aria-label="House code" placeholder="Enter house code" value={code} maxLength={36} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} autoCapitalize="none" autoCorrect="off" />
        <Button type="submit" disabled={!code.trim()} className="rounded-full">Join house</Button>
      </form>
    </main>
  </div>;
}