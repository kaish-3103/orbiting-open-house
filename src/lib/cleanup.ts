export type CleanupLease = { id: string; house_id: string; user_id: string; room_key: string; expires_at: string; token_expires_at: string; revoked: boolean; removed: boolean; media_kind?: string };
export function staleLease(lease: CleanupLease, authorized: boolean, now: number) { return !lease.removed && (lease.revoked || Date.parse(lease.expires_at) <= now || !authorized); }
export async function removeLease(lease: CleanupLease, provider: { disable: () => Promise<unknown>; remove: () => Promise<unknown> }, mark: (removed: boolean) => Promise<void>, now: number) {
  try { await provider.disable(); } catch (e) { if (!(e instanceof Error && 'status' in e && e.status === 404)) throw e; }
  try { await provider.remove(); } catch (e) { if (!(e instanceof Error && 'status' in e && e.status === 404)) throw e; }
  await mark(Date.parse(lease.token_expires_at) <= now);
}