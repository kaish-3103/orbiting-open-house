import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, ChevronDown, ChevronUp, DoorOpen, Hand, Link2, Lock, LogOut, Mic, MicOff, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/orbit/Logo";
import { FloorPlan, type PlanAvatar } from "@/components/orbit/FloorPlan";
import { VideoTile } from "@/components/orbit/VideoTile";
import { useOrbitMedia } from "@/hooks/useOrbitMedia";
import { ensureGuest } from "@/lib/guest";
import { activitySchema, knockSchema, houseAction } from "@/lib/house-actions";
import { reconcileVoice } from "@/lib/voice-access.functions";
import { useServerFn } from "@tanstack/react-start";
import { canEnter, roomAt, ROOMS, STATUSES, STATUS_LABEL, type DoorState, type Pt, type RoomKey, type Status } from "@/lib/house";

export const Route = createFileRoute("/house/$houseId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your house — Orbit" },
      { name: "description", content: "Your team's shared virtual house on Orbit." },
      { property: "og:title", content: "Orbit house" },
      { property: "og:description", content: "Walk into a room to talk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: House,
});

type Member = { user_id: string; display_name: string; color: string };
type Door = { room_key: string; owner_id: string | null; state: DoorState };
type Presence = { uid: string; name: string; color: string; status: Status; room: RoomKey | null; x: number; y: number; cam: boolean; mic: boolean; voice: boolean };
type Motion = { pos: Pt; path: Pt[]; motionId?: string };
const SPEED = 280; // px/s

function House() {
  const { houseId } = Route.useParams();
  const nav = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [houseName, setHouseName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [grants, setGrants] = useState<{ room_key: string; user_id: string }[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [doorsLoaded, setDoorsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [peers, setPeers] = useState<Record<string, Presence>>({});
  const [status, setStatus] = useState<Status>("available");
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [autoVoice, setAutoVoice] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [myRoom, setMyRoom] = useState<RoomKey | null>(null);
  const [, setTick] = useState(0);
  const motions = useRef<Record<string, Motion>>({});
  const reconcile = useServerFn(reconcileVoice);
  const arriving = useRef<string | null>(null);
  const seenKnocks = useRef(new Set<string>());
  const pendingKnock = useRef<Pt | null>(null);

  // ---------- data ----------
  const loadDoors = useCallback(async () => {
    const [{ data: d, error: de }, { data: g, error: ge }] = await Promise.all([
      supabase.from("room_doors").select("room_key,owner_id,state").eq("house_id", houseId),
      supabase.from("door_grants").select("room_key,user_id").eq("house_id", houseId),
    ]);
    if (de || ge) { setDoorsLoaded(false); setDoors([]); setGrants([]); throw new Error("Could not verify room permissions. Retry the house."); }
    setDoors((d as Door[]) ?? []);
    setGrants(g ?? []);
    setDoorsLoaded(true);
  }, [houseId]);
  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("house_members").select("user_id,display_name,color").eq("house_id", houseId);
    setMembers(data ?? []);
  }, [houseId]);

  useEffect(() => {
    setLoadError("");
    (async () => {
      try {
      const uid = await ensureGuest();
      setMe(uid);
      const { data: h } = await supabase.from("houses").select("name").eq("id", houseId).maybeSingle();
      if (!h) { setDenied(true); return; }
      setHouseName(h.name);
      const { data: inv } = await supabase.from("house_invites").select("token").eq("house_id", houseId).eq("revoked", false).limit(1).maybeSingle();
      setInvite(inv?.token ?? null);
      await Promise.all([loadDoors(), loadMembers()]);
      } catch (error) { setLoadError(error instanceof Error ? error.message : "Couldn't load your house. Please retry."); }
    })();
    const ch = supabase.channel(`db-${houseId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_doors", filter: `house_id=eq.${houseId}` }, () => loadDoors())
      .on("postgres_changes", { event: "*", schema: "public", table: "door_grants", filter: `house_id=eq.${houseId}` }, () => loadDoors())
      .on("postgres_changes", { event: "*", schema: "public", table: "house_members", filter: `house_id=eq.${houseId}` }, () => loadMembers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [houseId, loadDoors, loadMembers, loadAttempt]);

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);
  const doorMap = useMemo(() => Object.fromEntries(doors.map((d) => [d.room_key, d])) as Record<string, Door>, [doors]);
  const myDoorKey = doors.find((d) => d.owner_id === me)?.room_key as RoomKey | undefined;
  const access = useCallback((room: RoomKey) => me ? canEnter(room, me, doorMap[room], grants.some((g) => g.room_key === room && g.user_id === me)) : "locked", [me, doorMap, grants]);

  const media = useOrbitMedia({ houseId, enabled: !!me && doorsLoaded && !denied, myRoom, autoVoice, micOn, camOn, allowedRooms: (r) => access(r) === "ok", onCameraFailed: () => setCamOn(false), onMicFailed: () => setMicOn(false) });

  // Only authenticated database actions create activity and knock records.
  const syncActivity = useCallback(async () => {
    const { data, error } = await supabase.from("house_activity").select("*").eq("house_id", houseId);
    if (error) { setMyRoom(null); throw new Error("Could not verify house activity"); }
    const next: Record<string, Presence> = {};
    for (const raw of data ?? []) {
      const result = activitySchema.safeParse(raw);
      if (!result.success || Date.parse(result.data.updated_at) < Date.now() - 30000) continue;
      const a = result.data; const member = memberMap[a.user_id];
      if (!member) continue;
      next[a.user_id] = { uid: a.user_id, name: member.display_name, color: member.color, status: a.status, room: a.room_key, x: a.x, y: a.y, cam: a.cam, mic: a.mic, voice: a.mic };
      const motion = motions.current[a.user_id];
      if (!motion || motion.motionId !== a.motion_id) motions.current[a.user_id] = { pos: { x: a.x, y: a.y }, path: a.path, motionId: a.motion_id };
      else if (!a.path.length) { motion.pos = { x: a.x, y: a.y }; motion.path = []; }
      if (a.user_id === me) setMyRoom(a.room_key);
    }
    for (const uid of Object.keys(motions.current)) if (!next[uid]) delete motions.current[uid];
    setPeers(next);
  }, [houseId, me, memberMap]);
  const syncKnocks = useCallback(async () => {
    const { data, error } = await supabase.from("house_knocks").select("*").eq("house_id", houseId).gte("created_at", new Date(Date.now() - 60000).toISOString());
    if (error) throw new Error("Could not verify door requests");
    for (const raw of data ?? []) {
      const parsed = knockSchema.safeParse(raw); if (!parsed.success) continue;
      const k = parsed.data; const mark = `${k.id}:${k.decision}`;
      if (seenKnocks.current.has(mark)) continue;
      seenKnocks.current.add(mark);
      const reply = async (allow: boolean) => {
        try { await houseAction(houseId, "reply", { id: k.id, allow }); await loadDoors(); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Could not answer the knock"); }
      };
      if (k.owner_id === me && k.decision === "pending") {
        if (status === "dnd") { void reply(false); continue; }
        toast(`${memberMap[k.sender_id]?.display_name ?? "A house member"} is knocking on your door`, {
          duration: 20000, action: { label: "Let in", onClick: () => void reply(true) }, cancel: { label: "Not now", onClick: () => void reply(false) },
        });
      }
      if (k.sender_id === me && k.decision !== "pending") {
        if (k.decision === "allowed") { await loadDoors(); toast.success("You were let in"); const target = pendingKnock.current; pendingKnock.current = null; if (target) void moveToRef.current(target); }
        else { pendingKnock.current = null; toast("They can't let you in right now"); }
      }
    }
  }, [houseId, me, memberMap, status, loadDoors]);
  useEffect(() => {
    if (!me || !doorsLoaded || !members.length || denied) return;
    let disposed = false;
    const refresh = () => { if (!disposed) void syncActivity().catch((e) => toast.error(e.message)); };
    void houseAction(houseId, "enter").then(refresh).catch((e) => setLoadError(e.message));
    const ch = supabase.channel(`authorized-${houseId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "house_activity", filter: `house_id=eq.${houseId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "house_knocks", filter: `house_id=eq.${houseId}` }, () => { void syncKnocks().catch((e) => toast.error(e.message)); })
      .subscribe();
    const timer = setInterval(() => { refresh(); void syncKnocks().catch(() => {}); void reconcile({ data: { houseId } }).catch(() => {}); }, 3000);
    return () => { disposed = true; clearInterval(timer); void supabase.removeChannel(ch); };
  }, [me, houseId, doorsLoaded, members.length > 0, denied, syncActivity, syncKnocks]);
  useEffect(() => {
    if (!me || !doorsLoaded || denied) return;
    const heartbeat = () => { void houseAction(houseId, "heartbeat", { status, cam: media.cameraPublished, mic: media.micPublished }).catch(() => { setMyRoom(null); }); };
    heartbeat(); const timer = setInterval(heartbeat, 10000);
    return () => clearInterval(timer);
  }, [me, houseId, doorsLoaded, denied, status, media.cameraPublished, media.micPublished]);
  const statusRef = useRef(status); statusRef.current = status;

  // ---------- movement ----------
  const moveTo = useCallback(async (target: Pt) => {
    if (!me || !doorsLoaded) return;
    const rt = roomAt(target); if (!rt) return;
    const permission = access(rt);
    if (permission === "locked") { toast(`${ROOMS[rt].label} is locked`, { icon: <Lock className="h-4 w-4" /> }); return; }
    try {
      if (permission === "knock") {
        pendingKnock.current = target;
        await houseAction(houseId, "knock", { room: rt });
        toast("Knocked — waiting for an answer…", { icon: <Hand className="h-4 w-4" /> }); return;
      }
      const result = activitySchema.parse(await houseAction(houseId, "move", target));
      const motion = motions.current[me];
      motions.current[me] = { pos: motion?.pos ?? { x: result.x, y: result.y }, path: result.path, motionId: result.motion_id };
      setMyRoom(null); setMicOn(false);
      void reconcile({ data: { houseId } }).catch(() => {});
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't move. Retry."); }
  }, [me, doorsLoaded, access, houseId, reconcile]);
  const moveToRef = useRef(moveTo); moveToRef.current = moveTo;

  useEffect(() => {
    let raf = 0; let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      let changed = false;
      for (const [uid, m] of Object.entries(motions.current)) {
        if (!m.path.length) continue;
        changed = true;
        let step = SPEED * dt;
        while (step > 0 && m.path.length) {
          const tgt = m.path[0];
          if (!tgt) break;
          const dx = tgt.x - m.pos.x, dy = tgt.y - m.pos.y, d = Math.hypot(dx, dy);
          if (d <= step) { m.pos = { ...tgt }; m.path.shift(); step -= d; } else { m.pos = { x: m.pos.x + (dx / d) * step, y: m.pos.y + (dy / d) * step }; step = 0; }
        }
        if (uid === me && !m.path.length && m.motionId && arriving.current !== m.motionId) {
          const motionId = m.motionId; arriving.current = motionId;
          void houseAction(houseId, "arrive", { motionId }).then(() => syncActivity()).catch((e) => { setMyRoom(null); toast.error(e.message); });
        }
      }
      if (changed) setTick((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [me, houseId, syncActivity]);

  // room-change notifications
  const prevRoom = useRef<RoomKey | null>(null);
  useEffect(() => {
    if (prevRoom.current && myRoom && prevRoom.current !== myRoom) {
      if (prevRoom.current !== "hallway") toast(`Left ${ROOMS[prevRoom.current].label}`, { duration: 1500 });
      if (myRoom !== "hallway") toast(`Entered ${ROOMS[myRoom].label}`, { duration: 1500 });
    }
    prevRoom.current = myRoom;
  }, [myRoom]);
  const prevVoice = useRef<RoomKey | null>(null);
  useEffect(() => {
    if (media.voiceRoom && media.voiceRoom !== prevVoice.current) toast.success(`Connected to ${ROOMS[media.voiceRoom].label}`, { duration: 1800 });
    prevVoice.current = media.voiceRoom;
  }, [media.voiceRoom]);

  // inactivity -> away (never touches camera or mic)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let auto = false;
    const reset = () => {
      clearTimeout(timer);
      if (auto) { auto = false; setStatus("available"); }
      timer = setTimeout(() => { if (statusRef.current === "available" || statusRef.current === "working") { auto = true; setStatus("away"); } }, 10 * 60 * 1000);
    };
    reset();
    window.addEventListener("pointermove", reset);
    window.addEventListener("keydown", reset);
    return () => { clearTimeout(timer); window.removeEventListener("pointermove", reset); window.removeEventListener("keydown", reset); };
  }, []);

  // ---------- controls ----------
  async function toggleAutoVoice() {
    if (autoVoice) { setAutoVoice(false); setMicOn(false); return; }
    if (media.state === "unconfigured") { toast("Voice isn't set up for this house yet"); return; }
    setAutoVoice(true);
  }
  function toggleCam() {
    if (media.state === "unconfigured") { toast("Video isn't set up for this house yet"); return; }
    setCamOn((c) => !c);
  }
  function toggleMic() {
    if (!autoVoice) { toast("Turn on auto-connect voice first"); return; }
    if (!media.voiceRoom) { toast("Connect to voice in a room first"); return; }
    setMicOn((m) => !m);
  }
  function changeStatus(s: Status) {
    setStatus(s);
    if (s === "dnd") setMicOn(false);
  }
  async function setDoor(state: DoorState) {
    if (!myDoorKey) return;
    try { await houseAction(houseId, "door", { state }); await loadDoors(); const result = await reconcile({ data: { houseId } }); if (!result.ok) toast.error("Door changed; voice removal is retrying."); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not change door"); }
  }
  function copyInvite() {
    if (!invite) return;
    navigator.clipboard.writeText(invite).then(() => toast.success("House code copied"), () => toast.error("Couldn't copy. Select the house code and copy it."));
  }
  async function leave() {
    setCamOn(false); setMicOn(false); setAutoVoice(false);
    try { await houseAction(houseId, "leave"); await reconcile({ data: { houseId } }); } catch { toast.error("Voice removal will retry; close this tab if disconnected."); }
    nav({ to: "/" });
  }

  if (denied) return (
    <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-center"><h1 className="text-3xl font-semibold">You don't have a key to this house.</h1><p className="mt-2 text-muted-foreground">Ask a member for an invite link.</p></div></div>
  );
  if (loadError) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="max-w-md space-y-4 px-6"><p role="alert">{loadError}</p><Button onClick={() => setLoadAttempt((n) => n + 1)}>Retry</Button></div></div>;

  const online = Object.values(peers);
  const avatars: PlanAvatar[] = online.map((p) => {
    const pos = motions.current[p.uid]?.pos ?? { x: p.x, y: p.y };
    return { id: p.uid, name: p.name, color: p.color, x: pos.x, y: pos.y, status: p.status, moving: !!motions.current[p.uid]?.path.length, inVoice: p.voice && media.speakers.includes(p.uid) || (p.voice && p.uid === me), isMe: p.uid === me, track: media.videos[p.uid] };
  });
  const doorView = Object.fromEntries(doors.map((d) => [d.room_key, { state: d.state, ownerName: d.owner_id ? memberMap[d.owner_id]?.display_name : undefined }]));
  const myDoor = myDoorKey ? doorMap[myDoorKey] : undefined;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-chrome px-5 py-3 text-chrome-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <Logo light />
          <span className="h-5 w-px bg-chrome-muted" />
          <span className="max-w-48 truncate font-display text-lg">{houseName}</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-chrome-muted px-3 py-1 text-sm sm:flex"><Users className="h-3.5 w-3.5" />{online.length} online</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {myDoor && (
            <div className="flex items-center gap-1 rounded-full bg-chrome-muted p-1 text-sm">
              <span className="px-2 opacity-70">Your door</span>
              {(["open", "knock", "locked"] as DoorState[]).map((s) => (
                <Button key={s} size="sm" variant="ghost" title={s === "locked" ? "Owner only; removes guests and clears approvals" : s === "knock" ? "New approval required; removes unapproved guests" : "Anyone in this house may enter; clears old approvals"} onClick={() => setDoor(s)} className={`flex items-center gap-1 rounded-full px-3 py-1 capitalize transition ${myDoor.state === s ? "bg-chrome-foreground text-chrome" : "hover:bg-chrome"}`}>
                  {s === "open" ? <DoorOpen className="h-3.5 w-3.5" /> : s === "knock" ? <Hand className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}{s === "knock" ? "Knock" : s}
                </Button>
              ))}
            </div>
          )}
          {invite && <span className="select-all font-mono text-xs" aria-label="House code">{invite}</span>}
          <Button size="sm" variant="secondary" className="rounded-full" onClick={copyInvite}><Link2 className="mr-1 h-4 w-4" />Copy code</Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 items-center justify-center p-4">
          <div className="aspect-[1200/780] max-h-full w-full max-w-full rounded-[2rem] bg-card p-2 shadow-soft" style={{ maxWidth: "calc((100vh - 190px) * 1200 / 780)" }}>
            <FloorPlan avatars={avatars} doors={doorView} onFloorClick={(p) => moveTo(p)} highlight={myRoom} />
          </div>
          <div className="pointer-events-none absolute top-6 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full bg-chrome px-4 py-1.5 text-center text-sm text-chrome-foreground shadow-float">
            {myRoom ? ROOMS[myRoom].label : "…"} · {media.voiceRoom ? <span className="text-live">Voice connected</span> : media.voiceState === "error" ? "Voice failed" : autoVoice ? (myRoom === "hallway" ? "No voice in the hallway" : media.voiceState === "connecting" ? "Connecting voice…" : "Voice unavailable") : "Voice off"}
          </div>
          {media.state === "unconfigured" && (
            <div className="absolute bottom-6 left-6 max-w-xs rounded-2xl border bg-card p-4 text-sm shadow-float">
              <p className="font-semibold">Camera & voice need setup</p>
              <p className="text-muted-foreground">Movement and presence work now. Video and room voice switch on once the house's LiveKit keys are added.</p>
            </div>
          )}
          {Object.values(media.errors).some(Boolean) && <div role="alert" className="absolute bottom-6 left-6 max-w-xs space-y-2 rounded-lg border bg-card p-4 text-sm shadow-float">
            {Object.entries(media.errors).map(([key, error]) => error ? <p key={key}>{error}</p> : null)}
            {media.errors.voice && <Button size="sm" variant="outline" onClick={media.retryVoice}>Retry voice</Button>}
            {media.errors.connection && <Button size="sm" variant="outline" onClick={media.retryVideo}>Retry video</Button>}
          </div>}
        </main>

        <aside className={`hidden shrink-0 border-l bg-card transition-all sm:block ${dockOpen ? "w-72" : "w-12"}`}>
          <button onClick={() => setDockOpen(!dockOpen)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold" aria-label="Toggle video dock">
            {dockOpen && <span>People</span>}{dockOpen ? <ChevronDown className="h-4 w-4 -rotate-90" /> : <ChevronUp className="h-4 w-4 -rotate-90" />}
          </button>
          {dockOpen && (
            <div className="space-y-3 overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(100vh - 190px)" }}>
              {online.map((p) => <VideoTile key={p.uid} presence={p} track={media.videos[p.uid]} isMe={p.uid === me} speaking={media.speakers.includes(p.uid)} />)}
              {members.filter((m) => !peers[m.user_id]).map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-muted-foreground opacity-70">
                  <span className="h-3 w-3 rounded-full" style={{ background: `var(--${m.color})` }} />{m.display_name} · offline
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t bg-card px-4 py-3">
        <Button disabled={media.cameraBusy || media.state !== "ready"} variant={media.cameraPublished ? "default" : "outline"} className="rounded-full" onClick={toggleCam}>{media.cameraPublished ? <Camera className="mr-1 h-4 w-4" /> : <CameraOff className="mr-1 h-4 w-4" />}{media.cameraBusy ? "Camera…" : media.cameraPublished ? "Camera on" : "Camera off"}</Button>
        <Button disabled={media.micBusy || !media.voiceRoom} variant={media.micPublished ? "default" : "outline"} className="rounded-full" onClick={toggleMic}>{media.micPublished ? <Mic className="mr-1 h-4 w-4" /> : <MicOff className="mr-1 h-4 w-4" />}{media.micBusy ? "Mic…" : media.micPublished ? "Mic on" : "Muted"}</Button>
        <Button variant={autoVoice ? "default" : "outline"} className="rounded-full" onClick={toggleAutoVoice}><Radio className="mr-1 h-4 w-4" />Auto-connect voice {autoVoice ? "on" : "off"}</Button>
        <select value={status} onChange={(e) => changeStatus(e.target.value as Status)} className="h-9 rounded-full border bg-background px-3 text-sm" aria-label="Availability">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <Button variant="ghost" className="rounded-full" onClick={leave}><LogOut className="mr-1 h-4 w-4" />Leave house</Button>
      </footer>
    </div>
  );
}
