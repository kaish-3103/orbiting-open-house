import { describe, it, expect, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { activitySchema, houseAction, knockSchema } from "./house-actions";
describe("authenticated house action boundary", () => {
  it("does not pass a client identity for movement", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await houseAction("house", "move", { x: 300, y: 500 });
    expect(rpc).toHaveBeenCalledWith("orbit_action", { _house: "house", _action: "move", _payload: { x: 300, y: 500 } });
  });
  it("rejects non-finite coordinates and oversized paths", () => {
    const a = { house_id: "00000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000002", x: 600, y: 380, room_key: "hallway", path: [], motion_id: "00000000-0000-4000-8000-000000000003", status: "available", cam: false, mic: false, updated_at: new Date().toISOString() };
    expect(activitySchema.safeParse({ ...a, x: Infinity }).success).toBe(false);
    expect(activitySchema.safeParse({ ...a, path: Array(6).fill({ x: 600, y: 380 }) }).success).toBe(false);
  });
  it("does not interpret arbitrary broadcast allowed/from/to as a knock reply", () => {
    expect(knockSchema.safeParse({ from: "owner", to: "me", allowed: true }).success).toBe(false);
  });
  it("fails closed when room permissions cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Room access denied" } });
    await expect(houseAction("house", "move", { x: 230, y: 230 })).rejects.toThrow("Room access denied");
  });
});