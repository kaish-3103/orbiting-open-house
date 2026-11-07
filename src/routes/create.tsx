import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/orbit/Logo";
import { ColorPicker } from "@/components/orbit/IdentityPicker";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuest } from "@/lib/guest";

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

const templates = [
  { id: "founders_loft", name: "The Founders' Loft", body: "Two bedrooms, a lounge, a kitchen and a hallway.", ready: true },
  { id: "cozy", name: "The Cozy Apartment", body: "Coming soon", ready: false },
  { id: "studio", name: "The Modern Studio", body: "Coming soon", ready: false },
];

function Create() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [color, setColor] = useState("sage");
  const [house, setHouse] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    try {
      await ensureGuest();
      const { data, error } = await supabase.rpc("create_house", { _name: house, _display_name: name, _color: color });
      if (error) throw error;
      nav({ to: "/house/$houseId", params: { houseId: data as string } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const steps = [
    { title: "What should we call you?", ok: name.trim().length > 0, body: <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-12 text-lg" /> },
    { title: "Pick your avatar", ok: true, body: <ColorPicker value={color} onChange={setColor} /> },
    { title: "Choose a house", ok: true, body: (
      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className={`rounded-2xl border p-4 ${t.ready ? "border-primary bg-accent/40" : "opacity-60"}`}>
            <div className="flex items-center justify-between"><span className="font-semibold">{t.name}</span>
              {!t.ready && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Coming soon</span>}</div>
            <p className="text-sm text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>) },
    { title: "Name your house", ok: house.trim().length > 0, body: <Input autoFocus value={house} maxLength={60} onChange={(e) => setHouse(e.target.value)} placeholder="e.g. The Launchpad" className="h-12 text-lg" /> },
  ];
  const s = steps[step]!;

  return (
    <div className="min-h-screen bg-background bg-glow">
      <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
      <main className="mx-auto max-w-lg px-6 pt-10">
        <p className="mb-2 text-sm text-muted-foreground">Step {step + 1} of {steps.length}</p>
        <h1 className="mb-6 text-4xl font-semibold">{s.title}</h1>
        <form onSubmit={(e) => { e.preventDefault(); if (!s.ok) return; if (step < steps.length - 1) setStep(step + 1); else finish(); }}>
          {s.body}
          <div className="mt-8 flex justify-between">
            <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            <Button type="submit" disabled={!s.ok || busy} className="rounded-full px-7">{step === steps.length - 1 ? (busy ? "Moving in…" : "Enter the house") : "Continue"}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
