import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/orbit/Logo";
import { FloorPlan } from "@/components/orbit/FloorPlan";
import { DoorOpen, Mic, Video } from "lucide-react";

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

const features = [
  { icon: Video, title: "Persistent presence", body: "Leave your camera on and see your team working beside you — no meeting required." },
  { icon: Mic, title: "Natural conversations", body: "Walk into someone's room and you're talking. Walk out and the call simply ends." },
  { icon: DoorOpen, title: "Private spaces", body: "Your bedroom door can be open, knock-only or locked. Focus when you need it." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background bg-glow">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="ghost"><Link to="/create">Create your house</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-10 pb-12 text-center">
          <p className="mb-5 inline-block rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">Together, even when you're apart.</p>
          <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] md:text-6xl">
            Your team isn't in the same room. Now it can feel like it is.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Orbit is a virtual house you leave open all day. Everyone has a room, a little avatar, and an optional webcam. Talking is as easy as walking through a door.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7"><Link to="/create">Enter Orbit</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link to="/create">Create Your House</Link></Button>
          </div>
        </section>
        <section className="rounded-[2rem] border bg-card p-3 shadow-soft">
          <div className="aspect-[1200/780] w-full"><FloorPlan avatars={demo} doors={{ bedroom1: { state: "knock", ownerName: "Maya" }, bedroom2: { state: "open", ownerName: "Jonas" } }} /></div>
        </section>
        <section className="grid gap-6 py-20 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl border bg-card p-7">
              <f.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">Orbit · a home for people who work apart</footer>
    </div>
  );
}
