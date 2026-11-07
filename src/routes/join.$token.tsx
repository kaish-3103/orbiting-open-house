import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/orbit/Logo";
import { ColorPicker } from "@/components/orbit/IdentityPicker";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuest } from "@/lib/guest";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "You're invited — Orbit" },
      { name: "description", content: "Join your team's virtual house on Orbit." },
      { property: "og:title", content: "You're invited to an Orbit house" },
      { property: "og:description", content: "Pick a name and walk right in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Join,
});

function Join() {
  const { token } = Route.useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ house_name: string; member_count: number } | null | "invalid">(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("sky");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await ensureGuest();
        const { data } = await supabase.rpc("invite_preview", { _token: token });
        setInfo(data?.[0] ?? "invalid");
      } catch { setInfo("invalid"); }
    })();
  }, [token]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("join_house", { _token: token, _display_name: name, _color: color });
    if (error) { toast.error(error.message); setBusy(false); return; }
    nav({ to: "/house/$houseId", params: { houseId: data as string } });
  }

  return (
    <div className="min-h-screen bg-background bg-glow">
      <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
      <main className="mx-auto max-w-lg px-6 pt-10">
        {info === null && <p className="text-muted-foreground">Checking your invite…</p>}
        {info === "invalid" && <h1 className="text-3xl font-semibold">This invite link isn't valid.</h1>}
        {info && info !== "invalid" && (
          <form onSubmit={join} className="space-y-6">
            <p className="text-sm text-muted-foreground">{info.member_count} {info.member_count === 1 ? "person lives" : "people live"} here</p>
            <h1 className="text-4xl font-semibold">Join {info.house_name}</h1>
            <Input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-12 text-lg" />
            <ColorPicker value={color} onChange={setColor} />
            <Button type="submit" disabled={!name.trim() || busy} className="rounded-full px-7">{busy ? "Joining…" : "Enter the house"}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
