import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), leave: vi.fn(), rooms: [] as any[] }));
vi.mock("@/lib/livekit.functions", () => ({ getLivekitToken: mocks.token, leaveVoiceRoom: mocks.leave }));
vi.mock("livekit-client", () => {
  class Room {
    handlers = new Map<string, Function[]>();
    remoteParticipants = new Map();
    localParticipant = { identity: "me", isCameraEnabled: false, isMicrophoneEnabled: false, getTrackPublication: () => undefined, setCameraEnabled: vi.fn(async () => {}), setMicrophoneEnabled: vi.fn(async () => {}) };
    constructor() { mocks.rooms.push(this); }
    on(event: string, fn: Function) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]); return this; }
    emit(event: string, value?: unknown) { this.handlers.get(event)?.forEach((fn) => fn(value)); }
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
  }
  return { Room, Track: { Source: { Camera: "camera" } }, RoomEvent: Object.fromEntries(["TrackSubscribed", "TrackUnsubscribed", "TrackMuted", "TrackUnmuted", "LocalTrackPublished", "LocalTrackUnpublished", "ParticipantDisconnected", "Disconnected", "ActiveSpeakersChanged"].map((e) => [e, e])) };
});
import { useOrbitMedia } from "./useOrbitMedia";
const options = () => ({ houseId: "house", myRoom: "lounge" as const, autoVoice: true, micOn: false, camOn: false, allowedRooms: () => true, onCameraFailed: vi.fn(), onMicFailed: vi.fn() });
afterEach(() => { vi.clearAllMocks(); mocks.rooms.length = 0; });
describe("confirmed media state", () => {
  it("rolls failed camera and mic requests back and supports retry", async () => {
    mocks.token.mockResolvedValue({ configured: true, url: "wss://test.invalid", token: "test" }); mocks.leave.mockResolvedValue({ ok: true });
    const props = options(); const { result, rerender, unmount } = renderHook((p) => useOrbitMedia(p), { initialProps: props });
    await waitFor(() => expect(result.current.voiceRoom).toBe("lounge"));
    mocks.rooms[0].localParticipant.setCameraEnabled.mockRejectedValueOnce(new Error("permission"));
    mocks.rooms[1].localParticipant.setMicrophoneEnabled.mockRejectedValueOnce(new Error("device"));
    rerender({ ...props, camOn: true, micOn: true });
    await waitFor(() => expect(props.onCameraFailed).toHaveBeenCalled());
    await waitFor(() => expect(props.onMicFailed).toHaveBeenCalled());
    expect(result.current.cameraPublished).toBe(false); expect(result.current.micPublished).toBe(false);
    expect(result.current.errors.camera).toBeTruthy(); expect(result.current.errors.mic).toBeTruthy();
    rerender(props);
    await waitFor(() => expect(result.current.cameraBusy).toBe(false));
    mocks.rooms[0].localParticipant.setCameraEnabled.mockImplementation(async () => { mocks.rooms[0].localParticipant.isCameraEnabled = true; });
    rerender({ ...props, camOn: true });
    await waitFor(() => expect(result.current.cameraPublished).toBe(true));
    unmount();
  });
  it("clears attached audio on disconnect and exposes failed voice", async () => {
    mocks.token.mockResolvedValue({ configured: true, url: "wss://test.invalid", token: "test" }); mocks.leave.mockResolvedValue({ ok: true });
    const { result, unmount } = renderHook(() => useOrbitMedia(options()));
    await waitFor(() => expect(result.current.voiceRoom).toBe("lounge"));
    const el = document.createElement("audio"); el.play = vi.fn().mockResolvedValue(undefined); el.pause = vi.fn();
    act(() => mocks.rooms[1].emit("TrackSubscribed", { kind: "audio", attach: () => el }));
    expect(document.body.contains(el)).toBe(true);
    act(() => mocks.rooms[1].emit("Disconnected"));
    expect(document.body.contains(el)).toBe(false); expect(result.current.voiceRoom).toBe(null);
    expect(result.current.voiceState).toBe("error"); expect(result.current.micPublished).toBe(false);
    unmount();
  });
  it("token failure settles voice instead of connecting forever", async () => {
    mocks.token.mockImplementation(async ({ data }: { data: { kind: string } }) => { if (data.kind === "voice") throw new Error("offline"); return { configured: true, url: "wss://test.invalid", token: "test" }; });
    const { result, unmount } = renderHook(() => useOrbitMedia(options()));
    await waitFor(() => expect(result.current.voiceState).toBe("error"));
    expect(result.current.errors.voice).toBeTruthy(); unmount();
  });
});