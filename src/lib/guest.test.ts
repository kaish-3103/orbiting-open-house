import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), signInAnonymously: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
import { ensureGuest } from "./guest";
describe("guest identity", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("reuses an existing signed-in identity", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "existing" } }, error: null });
    expect(await ensureGuest()).toBe("existing"); expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("shares one guest creation between concurrent callers", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: "guest" } }, error: null });
    expect(await Promise.all([ensureGuest(), ensureGuest()])).toEqual(["guest", "guest"]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
  it("bounds hanging auth and safe retry does not create another identity", async () => {
    vi.useFakeTimers(); let release: (v: unknown) => void = () => {};
    auth.getUser.mockReturnValue(new Promise((r) => { release = r; }));
    const first = ensureGuest(); const rejected = expect(first).rejects.toThrow("taking too long");
    await vi.advanceTimersByTimeAsync(15000); await rejected;
    const retry = ensureGuest();
    release({ data: { user: { id: "same" } }, error: null });
    expect(await retry).toBe("same"); expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).not.toHaveBeenCalled(); vi.useRealTimers();
  });
  it("fails actionably instead of silently signing in after a network error", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "NetworkError" } });
    await expect(ensureGuest()).rejects.toThrow("connection and retry");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});