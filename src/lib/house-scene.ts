import type { Pt } from './house';

/** The scene is a presentation of the authoritative plan, never another geometry model. */
export function planToWorld(point: Pt): [number, number, number] {
  return [(point.x - 600) / 100, 0, (point.y - 390) / 100];
}

export function worldToPlan(x: number, z: number): Pt {
  return { x: x * 100 + 600, y: z * 100 + 390 };
}