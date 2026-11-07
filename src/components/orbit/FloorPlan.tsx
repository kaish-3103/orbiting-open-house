import { useRef, type MouseEvent } from "react";
import type { Track } from "livekit-client";
import { AvatarVideo } from "@/components/orbit/AvatarVideo";
import { DOORS, PLAN, ROOMS, type DoorState, type Pt, type RoomKey } from "@/lib/house";

export type PlanAvatar = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  status?: string;
  moving?: boolean;
  inVoice?: boolean;
  isMe?: boolean;
  track?: Track | undefined;
};

type Props = {
  avatars: PlanAvatar[];
  doors?: Partial<Record<RoomKey, { state: DoorState; ownerName?: string | undefined }>>;
  onFloorClick?: (p: Pt) => void;
  highlight?: RoomKey | null;
};

const fill: Record<RoomKey, string> = {
  bedroom1: "var(--room-bedroom)",
  bedroom2: "var(--room-bedroom2)",
  hallway: "var(--room-hall)",
  lounge: "var(--room-lounge)",
  kitchen: "var(--room-kitchen)",
};

const statusColor: Record<string, string> = {
  available: "var(--live)",
  working: "var(--sky)",
  dnd: "var(--destructive)",
  away: "var(--honey)",
};

function Bedroom({ x, flip }: { x: number; flip?: boolean }) {
  const bx = flip ? x + 380 : x + 30;
  const dx = flip ? x + 40 : x + 330;
  return (
    <g>
      {/* rug */}
      <rect x={x + 170} y={150} width={200} height={130} rx={20} fill="var(--card)" opacity={0.7} />
      {/* bed */}
      <rect x={bx} y={70} width={130} height={190} rx={18} fill="var(--card)" stroke="var(--border)" strokeWidth={2} />
      <rect x={bx + 12} y={82} width={106} height={40} rx={12} fill="var(--secondary)" />
      <rect x={bx} y={150} width={130} height={110} rx={18} fill="var(--fabric)" opacity={0.55} />
      {/* desk + laptop + chair */}
      <rect x={dx} y={62} width={170} height={64} rx={10} fill="var(--wood)" />
      <rect x={dx + 55} y={74} width={60} height={38} rx={5} fill="var(--wall)" />
      <rect x={dx + 60} y={78} width={50} height={28} rx={3} fill="var(--sky)" opacity={0.8} />
      <circle cx={dx + 85} cy={150} r={20} fill="var(--chrome-muted)" opacity={0.85} />
      {/* bookshelf */}
      <rect x={flip ? x + 230 : x + 200} y={52} width={90} height={24} rx={5} fill="var(--wood-dark)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={(flip ? x + 236 : x + 206) + i * 16} y={55} width={10} height={18} rx={2}
          fill={["var(--coral)", "var(--sage)", "var(--lavender)", "var(--honey)", "var(--sky)"][i]} />
      ))}
      {/* plant */}
      <circle cx={flip ? x + 500 : x + 40} cy={310} r={16} fill="var(--plant)" />
    </g>
  );
}

function Lounge() {
  return (
    <g>
      <rect x={130} y={540} width={360} height={150} rx={30} fill="var(--card)" opacity={0.7} />
      <rect x={110} y={650} width={400} height={64} rx={24} fill="var(--fabric)" />
      <rect x={110} y={630} width={400} height={30} rx={14} fill="var(--fabric)" opacity={0.75} />
      <rect x={80} y={540} width={60} height={150} rx={22} fill="var(--fabric)" opacity={0.85} />
      <rect x={230} y={570} width={160} height={60} rx={14} fill="var(--wood)" />
      <circle cx={270} cy={600} r={9} fill="var(--coral)" />
      <circle cx={600} cy={470} r={22} fill="var(--plant)" />
      <circle cx={75} cy={470} r={18} fill="var(--plant)" />
      <circle cx={600} cy={700} r={18} fill="var(--plant)" />
    </g>
  );
}

function Kitchen() {
  return (
    <g>
      <rect x={1080} y={440} width={60} height={280} rx={10} fill="var(--wood-dark)" />
      <rect x={1088} y={470} width={44} height={40} rx={8} fill="var(--chrome-muted)" opacity={0.6} />
      <rect x={1088} y={560} width={44} height={60} rx={8} fill="var(--card)" />
      <ellipse cx={890} cy={600} rx={110} ry={70} fill="var(--wood)" />
      {[[780, 600], [1000, 600], [890, 515], [890, 685]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={18} fill="var(--card)" stroke="var(--border)" strokeWidth={2} />
      ))}
      <circle cx={870} cy={590} r={10} fill="var(--honey)" />
      <circle cx={905} cy={610} r={8} fill="var(--sage)" />
      <circle cx={735} cy={705} r={16} fill="var(--plant)" />
    </g>
  );
}

function DoorBadge({ room, state, ownerName }: { room: RoomKey; state: DoorState; ownerName?: string | undefined }) {
  const d = DOORS[room as keyof typeof DOORS];
  const r = ROOMS[room].rect;
  const cx = (d.x0 + d.x1) / 2;
  const icon = state === "locked" ? "🔒" : state === "knock" ? "✋" : "🚪";
  return (
    <g pointerEvents="none">
      <rect x={r.x + 14} y={r.y + 14} rx={12} height={26} width={(ROOMS[room].label.length + (ownerName ? ownerName.length + 3 : 0)) * 7.6 + 30}
        fill="var(--chrome)" opacity={0.92} />
      <text x={r.x + 28} y={r.y + 32} fontSize={13} fill="var(--chrome-foreground)" fontFamily="var(--font-sans)">
        {ROOMS[room].label}{ownerName ? ` · ${ownerName}` : ""}
      </text>
      <g transform={`translate(${cx - 12}, ${d.wallY - 12})`}>
        <circle cx={12} cy={12} r={14} fill="var(--card)" stroke="var(--wall)" strokeWidth={2} />
        <text x={12} y={17} fontSize={13} textAnchor="middle">{icon}</text>
      </g>
    </g>
  );
}

export function FloorPlan({ avatars, doors, onFloorClick, highlight }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onFloorClick || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    onFloorClick({ x: p.x, y: p.y });
  }

  // Walls: draw outer + interior walls with door gaps
  const W = 8;
  const wall = "var(--wall)";
  const seg = (x1: number, y1: number, x2: number, y2: number, k: string) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={wall} strokeWidth={W} strokeLinecap="round" />
  );

  return (
    <svg ref={svgRef} viewBox={`0 0 ${PLAN.w} ${PLAN.h}`} className="h-full w-full select-none"
      onClick={handleClick} style={{ cursor: onFloorClick ? "pointer" : "default" }}>
      <defs>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect x={20} y={20} width={1160} height={740} rx={36} fill="var(--floor)" />
      {(Object.keys(ROOMS) as RoomKey[]).map((k) => {
        const r = ROOMS[k].rect;
        return (
          <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill[k]}
            opacity={highlight && highlight !== k ? 0.85 : 1} />
        );
      })}
      {/* wall between bedrooms and between lounge/kitchen */}
      <rect x={580} y={40} width={40} height={300} fill="var(--floor)" />
      <rect x={660} y={420} width={40} height={320} fill="var(--floor)" />

      <g filter="url(#soft)">
        <Bedroom x={40} />
        <Bedroom x={620} flip />
        <Lounge />
        <Kitchen />
      </g>

      {/* walls */}
      <rect x={40} y={40} width={1120} height={700} rx={4} fill="none" stroke={wall} strokeWidth={W} />
      {seg(580, 40, 580, 340, "b1r")}
      {seg(620, 40, 620, 340, "b2l")}
      {seg(660, 420, 660, 740, "lr")}
      {seg(700, 420, 700, 740, "kl")}
      {seg(40, 340, DOORS.bedroom1.x0, 340, "b1a")}
      {seg(DOORS.bedroom1.x1, 340, 580, 340, "b1b")}
      {seg(620, 340, DOORS.bedroom2.x0, 340, "b2a")}
      {seg(DOORS.bedroom2.x1, 340, 1160, 340, "b2b")}
      {seg(580, 340, 620, 340, "bmid")}
      {seg(40, 420, DOORS.lounge.x0, 420, "la")}
      {seg(DOORS.lounge.x1, 420, 660, 420, "lb")}
      {seg(660, 420, 700, 420, "mid")}
      {seg(700, 420, DOORS.kitchen.x0, 420, "ka")}
      {seg(DOORS.kitchen.x1, 420, 1160, 420, "kb")}

      {/* communal labels */}
      {(["lounge", "kitchen", "hallway"] as RoomKey[]).map((k) => {
        const r = ROOMS[k].rect;
        return (
          <text key={k} x={k === "hallway" ? r.x + 18 : r.x + 20} y={k === "hallway" ? r.y + 46 : r.y + 34}
            fontSize={k === "hallway" ? 12 : 14} fill="var(--muted-foreground)" fontFamily="var(--font-display)"
            letterSpacing={k === "hallway" ? 3 : 0} pointerEvents="none">
            {k === "hallway" ? "HALLWAY" : ROOMS[k].label}
          </text>
        );
      })}

      {(["bedroom1", "bedroom2"] as RoomKey[]).map((k) => (
        <DoorBadge key={k} room={k} state={doors?.[k]?.state ?? "open"} ownerName={doors?.[k]?.ownerName} />
      ))}

      {/* avatars */}
      {avatars.map((a) => (
        <g key={a.id} transform={`translate(${a.x}, ${a.y})`} pointerEvents="none">
          {a.inVoice && <circle className="voice-ring" r={20} fill="none" stroke="var(--live)" strokeWidth={3} />}
          <ellipse cx={0} cy={20} rx={16} ry={5} fill="var(--wall)" opacity={0.15} />
          <g className={a.moving ? "" : "avatar-idle"}>
            <circle r={20} fill={`var(--${a.color})`} stroke={a.isMe ? "var(--wall)" : "var(--card)"} strokeWidth={a.isMe ? 4 : 3} />
            {a.track ? <AvatarVideo track={a.track} isMe={a.isMe} /> : <g>
            <circle cx={-6} cy={-4} r={2.5} fill="var(--wall)" />
            <circle cx={6} cy={-4} r={2.5} fill="var(--wall)" />
            <path d="M -6 6 Q 0 11 6 6" stroke="var(--wall)" strokeWidth={2} fill="none" strokeLinecap="round" />
            </g>}
          </g>
          {a.status && <circle cx={15} cy={-15} r={6} fill={statusColor[a.status] ?? "var(--muted)"} stroke="var(--card)" strokeWidth={2} />}
          <g transform="translate(0, 38)">
            <rect x={-(a.name.length * 4 + 12)} y={-12} width={a.name.length * 8 + 24} height={22} rx={11} fill="var(--chrome)" opacity={0.9} />
            <text y={4} textAnchor="middle" fontSize={12} fill="var(--chrome-foreground)" fontFamily="var(--font-sans)" fontWeight={600}>
              {a.name}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
