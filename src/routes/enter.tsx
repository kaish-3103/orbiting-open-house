import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/orbit/Logo";

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
  return <div className="min-h-screen bg-background bg-glow">
    <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
    <main className="mx-auto max-w-lg space-y-8 px-6 pt-10">
      <h1 className="text-4xl font-semibold">Enter Orbit</h1>
      <Button asChild className="rounded-full"><Link to="/create">Make a new house</Link></Button>
      <form className="space-y-4 border-t pt-6" onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate({ to: "/join/$token", params: { token: code.trim().toLowerCase() } }); }}>
        <h2 className="text-xl font-semibold">Join with a code</h2>
        <Input aria-label="House code" placeholder="Enter house code" value={code} maxLength={36} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} autoCapitalize="none" autoCorrect="off" />
        <Button type="submit" disabled={!code.trim()} className="rounded-full">Join house</Button>
      </form>
    </main>
  </div>;
}