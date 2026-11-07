import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/orbit/Logo";
import { FloorPlan } from "@/components/orbit/FloorPlan";
import { ArrowRight, Plus, KeyRound } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbit — A persistent virtual home for remote teams" },
      { name: "description", content: "Share a virtual house with your team. Walk into a room to talk, keep your camera on to feel together." },
      { property: "og:title", content: "Orbit — Together, even when you're apart" },
      { property: "og:description", content: "Your team isn't in the same room. Now it can feel like it is." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const demo = [
  { id: "a", name: "Maya", color: "lavender", x: 400, y: 180, status: "working" },
  { id: "b", name: "Jonas", color: "sky", x: 980, y: 210, status: "available" },
  { id: "c", name: "Priya", color: "sage", x: 260, y: 520, status: "available", inVoice: true },
  { id: "d", name: "Leo", color: "honey", x: 360, y: 520, status: "available", inVoice: true },
  { id: "e", name: "Ana", color: "coral", x: 890, y: 560, status: "away" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <span className="text-sm text-muted-foreground">A little closer, wherever you are.</span>
        <Button asChild variant="ghost" size="sm" className="shrink-0"><Link to="/enter"><KeyRound className="h-4 w-4" />Join a house</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="pt-8 pb-10 text-center sm:pt-12 sm:pb-12">
          <h1 className="flex justify-center"><Logo size="hero" /></h1>
          <h2 className="mt-6 text-2xl font-medium sm:text-3xl">Different places. Same home.</h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">For your people, not another meeting.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="px-6"><Link to="/enter">Enter Orbit<ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="px-6"><Link to="/create"><Plus className="h-4 w-4" />Create a house</Link></Button>
          </div>
        </section>
        <section aria-label="Founders’ Loft" className="pb-12">
          <div className="mb-3 flex items-center justify-between border-b pb-3 text-sm">
            <span className="font-display text-lg">Founders’ Loft</span>
            <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-live" />A place to be together</span>
          </div>
          <div className="aspect-[1200/780] w-full"><FloorPlan avatars={demo} doors={{ bedroom1: { state: "knock", ownerName: "Maya" }, bedroom2: { state: "open", ownerName: "Jonas" } }} /></div>
        </section>
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">Orbit · a home for people who work apart</footer>
    </div>
  );
}
