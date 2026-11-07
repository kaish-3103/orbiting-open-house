import { describe, expect, it } from "vitest";
import { VoiceSession } from "./voice-session";

function deferred() { let resolve = () => {}; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }
describe("voice switching", () => {
  it("waits for server teardown before rapid A → hall → A rejoin", async () => {
    const removal = deferred(); const events: string[] = [];
    const session = new VoiceSession<string>(async (key) => {
      events.push(`join:${key}`);
      return { key, disconnect: async () => { events.push("disconnect"); }, remove: async () => { events.push("remove:start"); await removal.promise; events.push("remove:end"); } };
    });
    await session.switchTo("A", () => {});
    const hall = session.switchTo(null, () => {});
    const back = session.switchTo("A", () => {});
    await Promise.resolve(); await Promise.resolve();
    expect(events.filter((e) => e === "join:A")).toHaveLength(1);
    removal.resolve(); await hall; await back;
    expect(events).toEqual(["join:A", "disconnect", "remove:start", "remove:end", "join:A"]);
  });
  it("unmount during join cleans stale connection and never reports connected", async () => {
    const joined = deferred(); const events: string[] = [];
    const session = new VoiceSession<string>(async (key) => { await joined.promise; return { key, disconnect: async () => { events.push("disconnect"); }, remove: async () => { events.push("remove"); } }; });
    const pending = session.switchTo("A", (key) => { if (key) events.push("connected"); });
    await Promise.resolve();
    const unmount = session.switchTo(null, () => {});
    joined.resolve(); await pending; await unmount;
    expect(events).toEqual(["disconnect", "remove"]);
  });
  it("blocks new joins when server removal fails and retries teardown first", async () => {
    let fail = true; let joins = 0; let reported: unknown;
    const session = new VoiceSession<string>(async (key) => { joins++; return { key, disconnect: async () => {}, remove: async () => { if (fail) throw new Error("offline"); } }; });
    await session.switchTo("A", () => {});
    await session.switchTo("B", (_, error) => { reported = error; });
    expect(reported).toBeInstanceOf(Error); expect(joins).toBe(1);
    fail = false;
    await session.switchTo("B", () => {});
    expect(joins).toBe(2);
  });
  it("reports connect failure rather than a false connected state", async () => {
    let error: unknown; let connected = false;
    const session = new VoiceSession<string>(async (key) => ({ key, failure: new Error("connect failed"), disconnect: async () => {}, remove: async () => {} }));
    await session.switchTo("A", (key, e) => { connected = !!key; error = e; });
    expect(connected).toBe(false); expect(error).toBeInstanceOf(Error);
  });
});