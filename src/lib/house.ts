// Founders' Loft geometry, room detection and waypoint pathing. Pure + testable.
export type RoomKey = "bedroom1" | "bedroom2" | "hallway" | "lounge" | "kitchen";
export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const PLAN = { w: 1200, h: 780 };
export const AVATAR_R = 22;

export const ROOMS: Record<RoomKey, { label: string; rect: Rect; private: boolean }> = {
  bedroom1: { label: "Bedroom 1", rect: { x: 40, y: 40, w: 540, h: 300 }, private: true },
  bedroom2: { label: "Bedroom 2", rect: { x: 620, y: 40, w: 540, h: 300 }, private: true },
  hallway: { label: "Hallway", rect: { x: 40, y: 340, w: 1120, h: 80 }, private: false },
  lounge: { label: "Lounge", rect: { x: 40, y: 420, w: 620, h: 320 }, private: false },
  kitchen: { label: "Kitchen", rect: { x: 700, y: 420, w: 460, h: 320 }, private: false },
};

// Door openings on the hallway wall: [x0, x1]
export const DOORS: Record<Exclude<RoomKey, "hallway">, { x0: number; x1: number; wallY: number }> = {
  bedroom1: { x0: 440, x1: 520, wallY: 340 },
  bedroom2: { x0: 680, x1: 760, wallY: 340 },
  lounge: { x0: 180, x1: 400, wallY: 420 },
  kitchen: { x0: 820, x1: 980, wallY: 420 },
};

export const VOICE_ROOMS: RoomKey[] = ["bedroom1", "bedroom2", "lounge", "kitchen"];
export const PRIVATE_ROOMS = ["bedroom1", "bedroom2"] as const;

export function inRect(p: Pt, r: Rect) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function roomAt(p: Pt): RoomKey | null {
  for (const k of ["hallway", "bedroom1", "bedroom2", "lounge", "kitchen"] as RoomKey[]) {
    if (inRect(p, ROOMS[k].rect)) return k;
  }
  return null;
}

export function clampToRoom(p: Pt, room: RoomKey): Pt {
  const r = ROOMS[room].rect;
  const m = AVATAR_R + 4;
  return {
    x: Math.min(Math.max(p.x, r.x + m), r.x + r.w - m),
    y: Math.min(Math.max(p.y, r.y + m), r.y + r.h - m),
  };
}

function doorPoints(room: Exclude<RoomKey, "hallway">) {
  const d = DOORS[room];
  const cx = (d.x0 + d.x1) / 2;
  const up = room === "bedroom1" || room === "bedroom2";
  return {
    inside: { x: cx, y: up ? d.wallY - 34 : d.wallY + 34 },
    hall: { x: cx, y: 380 },
  };
}

/** Waypoint path from `from` to `to`, never crossing walls (rooms connect only via the hallway). */
export function planPath(from: Pt, to: Pt): Pt[] {
  const rf = roomAt(from) ?? "hallway";
  const rt = roomAt(to);
  if (!rt) return [];
  const target = clampToRoom(to, rt);
  if (rf === rt) return [target];
  const pts: Pt[] = [];
  if (rf !== "hallway") {
    const d = doorPoints(rf);
    pts.push(d.inside, d.hall);
  }
  if (rt !== "hallway") {
    const d = doorPoints(rt);
    pts.push(d.hall, d.inside);
  }
  pts.push(target);
  return pts;
}

export type DoorState = "open" | "knock" | "locked";

/** Whether `userId` may enter `room` given door info (client mirror of the server rule). */
export function canEnter(
  room: RoomKey,
  userId: string,
  door: { owner_id: string | null; state: DoorState } | undefined,
  hasGrant: boolean,
): "ok" | "knock" | "locked" {
  if (room === "hallway" || room === "lounge" || room === "kitchen") return "ok";
  if (!door) return "locked";
  if (door.owner_id === userId || door.state === "open") return "ok";
  if (door.state === "locked") return "locked";
  return hasGrant ? "ok" : "knock";
}

export const AVATAR_COLORS = ["sage", "sky", "lavender", "honey", "coral"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];
export const STATUSES = ["available", "working", "dnd", "away"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  working: "Working",
  dnd: "Do Not Disturb",
  away: "Away",
};

export function spawnPoint(room: RoomKey | null): Pt {
  if (room === "bedroom1") return { x: 230, y: 230 };
  if (room === "bedroom2") return { x: 970, y: 230 };
  return { x: 600 + (Math.random() * 120 - 60), y: 380 };
}
