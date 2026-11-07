import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guest: vi.fn(), rpc: vi.fn(), nav: vi.fn() }));
vi.mock("@/lib/guest", () => ({ ensureGuest: mocks.guest }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }), useNavigate: () => mocks.nav, Link: () => null }));
import { Route } from "./create";
function fillSteps() {
  fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "QA" } });
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByPlaceholderText("e.g. The Launchpad"), { target: { value: "QA house" } });
}
describe("house creation", () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
  it('sends the owner-selected office layout when creating the house',async()=>{
    mocks.guest.mockResolvedValue('guest');mocks.rpc.mockResolvedValue({data:'office-house',error:null});
    const Component=Route.options.component;if(!Component)throw new Error('missing component');
    const view=render(<Component />);
    fireEvent.change(screen.getByPlaceholderText('Your name'),{target:{value:'Owner'}});
    fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    fireEvent.click(screen.getByRole('button',{name:/Cooperative Office/}));fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    fireEvent.change(screen.getByPlaceholderText('e.g. The Launchpad'),{target:{value:'Office'}});fireEvent.click(screen.getByRole('button',{name:'Enter the house'}));
    await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('create_house_layout',expect.objectContaining({_layout:'office'})));view.unmount();
  });
  it("waits for guest auth and reuses the request ID on uncertain failure", async () => {
    let signIn: (id: string) => void = () => {};
    mocks.guest.mockReturnValue(new Promise<string>((resolve) => { signIn = resolve; }));
    mocks.rpc.mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({ data: "same-house", error: null });
    const Component = Route.options.component;
    if (!Component) throw new Error("missing component");
    const view = render(<Component />); fillSteps();
    fireEvent.click(screen.getByRole("button", { name: "Enter the house" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    signIn("guest");
    await screen.findByRole("button", { name: "Retry safely" });
    fireEvent.click(screen.getByRole("button", { name: "Retry safely" }));
    await waitFor(() => expect(mocks.nav).toHaveBeenCalledWith({ to: "/house/$houseId", params: { houseId: "same-house" } }));
    expect(mocks.rpc.mock.calls[0]?.[1]._request_id).toBe(mocks.rpc.mock.calls[1]?.[1]._request_id);
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("create_house_layout");
    expect(mocks.rpc.mock.calls[0]?.[1]._layout).toBe('loft');
    view.unmount();
  });
  it("clears busy on guest failure without creating a house", async () => {
    mocks.guest.mockRejectedValue(new Error("sign-in timed out"));
    const Component = Route.options.component;
    if (!Component) throw new Error("missing component");
    const view = render(<Component />); fillSteps();
    fireEvent.click(screen.getByRole("button", { name: "Enter the house" }));
    await screen.findByRole("button", { name: "Retry safely" });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("sign-in timed out");
    view.unmount();
  });
});