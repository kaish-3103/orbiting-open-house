import { describe, it, expect } from "vitest";
import { roomAt, planPath, canEnter } from "./house";

describe("room geometry", () => {
  it("detects rooms", () => {
    expect(roomAt({ x: 200, y: 200 })).toBe("bedroom1");
    expect(roomAt({ x: 900, y: 200 })).toBe("bedroom2");
    expect(roomAt({ x: 600, y: 380 })).toBe("hallway");
    expect(roomAt({ x: 300, y: 600 })).toBe("lounge");
    expect(roomAt({ x: 900, y: 600 })).toBe("kitchen");
  });
  it("routes between bedrooms through the hallway doors", () => {
    const p = planPath({ x: 200, y: 200 }, { x: 900, y: 200 });
    expect(p.length).toBe(5);
    expect(roomAt(p[1]!)).toBe("hallway");
    expect(roomAt(p[2]!)).toBe("hallway");
    expect(roomAt(p[4]!)).toBe("bedroom2");
  });
});

describe("door rules", () => {
  const door = (state: "open" | "knock" | "locked") => ({ owner_id: "owner", state });
  it("locked blocks visitors but not owner", () => {
    expect(canEnter("bedroom2", "guest", door("locked"), false)).toBe("locked");
    expect(canEnter("bedroom2", "owner", door("locked"), false)).toBe("ok");
  });
  it("knock needs a grant", () => {
    expect(canEnter("bedroom2", "guest", door("knock"), false)).toBe("knock");
    expect(canEnter("bedroom2", "guest", door("knock"), true)).toBe("ok");
  });
  it("communal rooms are always open", () => {
    expect(canEnter("lounge", "guest", undefined, false)).toBe("ok");
  });
});
