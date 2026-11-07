import { describe, expect, it } from 'vitest';
import { planToWorld, worldToPlan } from './house-scene';

describe('3D presentation coordinate mapping', () => {
  it('keeps the hallway and bedroom door in their authoritative locations', () => {
    expect(planToWorld({ x: 600, y: 380 })).toEqual([0, 0, -0.1]);
    expect(worldToPlan(-1.2, -0.5)).toEqual({ x: 480, y: 340 });
  });
  it('round trips floor clicks without changing room coordinates', () => {
    const [x, , z] = planToWorld({ x: 900, y: 600 });
    expect(worldToPlan(x, z)).toEqual({ x: 900, y: 600 });
  });
});