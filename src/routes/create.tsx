import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/orbit/Logo";
import { ColorPicker } from "@/components/orbit/IdentityPicker";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuest } from "@/lib/guest";
import { bounded } from "@/lib/async-operation";
import { LAYOUTS, type SpaceStyle } from '@/lib/layout';

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create your house — Orbit" },
      { name: "description", content: "Set up your Orbit house in a few steps and invite your team." },
      { property: "og:title", content: "Create your Orbit house" },
      { property: "og:description", content: "Name yourself, pick a look, and move in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Create,
});

function Create() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState("sage");
  const [layout,setLayout]=useState<SpaceStyle>('loft');
  const [house, setHouse] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef<string | null>(null);
  const submitting = useRef(false);

  async function finish() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFailure("");
    try {
      await ensureGuest();
      if (!request.current) {
        request.current = sessionStorage.getItem("orbit-create-request") ?? crypto.randomUUID();
        sessionStorage.setItem("orbit-create-request", request.current);
      }
      const { data, error } = await bounded(supabase.rpc("create_house_layout", { _name: house, _display_name: name, _color: color, _request_id: request.current, _layout:layout }), "Creating your house is taking too long. Check your connection and retry; retrying won't create a second house.");
      if (error) throw error;
      if (!data) throw new Error("The house wasn't confirmed. Please retry.");
      await nav({ to: "/house/$houseId", params: { houseId: data } });
      sessionStorage.removeItem("orbit-create-request");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't create your house. Check your connection and retry.";
      setFailure(message);
      toast.error(message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  const steps = [
    { title: "What should we call you?", ok: name.trim().length > 0, body: <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-12 text-lg" /> },
    { title: "Pick your avatar", ok: true, body: <ColorPicker value={color} onChange={setColor} /> },
    { title: "Choose a house", ok: true, body: (
      <div className="grid gap-3">
        {LAYOUTS.map(t=><Button key={t.id} type="button" variant={layout===t.id?'default':'outline'} aria-pressed={layout===t.id} className="h-auto items-start flex-col whitespace-normal p-4 text-left" onClick={()=>setLayout(t.id)}><span className="font-semibold">{t.name}</span><span className="text-sm font-normal">{t.description}</span></Button>)}
        <p className="text-sm text-muted-foreground">This house’s layout is permanent once created.</p>
      </div>) },
    { title: "Name your house", ok: house.trim().length > 0, body: <Input autoFocus value={house} maxLength={60} onChange={(e) => setHouse(e.target.value)} placeholder="e.g. The Launchpad" className="h-12 text-lg" /> },
  ];
  const s = steps[step];
  if (!s) return null;

  return (
    <div className="min-h-screen bg-background bg-glow">
      <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
      <main className="mx-auto max-w-lg px-6 pt-10">
        <p className="mb-2 text-sm text-muted-foreground">Step {step + 1} of {steps.length}</p>
        <h1 className="mb-6 text-4xl font-semibold">{s.title}</h1>
        <form onSubmit={(e) => { e.preventDefault(); if (!s.ok) return; if (step < steps.length - 1) setStep(step + 1); else finish(); }}>
          {s.body}
          {failure && <p role="alert" className="mt-4 text-sm text-destructive">{failure}</p>}
          <div className="mt-8 flex justify-between">
            <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</Button>
            <Button type="submit" disabled={!s.ok || busy} className="rounded-full px-7">{step === steps.length - 1 ? (busy ? "Moving in…" : failure ? "Retry safely" : "Enter the house") : "Continue"}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
