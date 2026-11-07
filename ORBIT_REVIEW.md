# Orbit review

## Delivered
- Preserved the existing visual design. Added create-or-join entry and a shared house code; existing invite links and bedroom door controls continue to work.
- Camera tracks render inside moving circular avatars as well as the People dock.
- Guest auth is single-flight with a 15-second user-facing deadline. Late attempts cannot trigger a second guest sign-in during retry.
- Creation uses an owner-scoped, database-enforced request ID, retained across uncertain failures and reloads. Back and repeated submission are disabled while submitting.
- Invite checks and joins have bounded, actionable errors and retry controls.
- Video setup waits for guest authentication and membership loading.
- Voice teardown and join are serialized. Server removal is awaited, including during stale joins and unmount. Failed removal prevents another join until teardown succeeds; the UI watchdog reports delays without releasing the serialization barrier.
- Camera and mic controls and presence reflect confirmed publication. Failures roll back requested toggles, show actionable errors, and allow another attempt. Voice failure no longer remains Connecting indefinitely. Attached audio is removed on disconnect/unmount.
- Narrow layout fixes keep controls and the plan usable on phones.

## Checks
- All 19 tests passed across 6 files: guest single-flight/timeout, creation ordering/retry, rapid voice switching/unmount/teardown failure, camera/mic rollback and retry, audio cleanup/voice failure, geometry/doors, routing.
- Automatic preview build/typecheck: build OK.
- Real browser flow: completed four-step create, deliberately lost the response after the database committed, retried with the same request ID, and entered the original house. Database readback confirmed one house and two members in the first run.
- A second fresh browser entered the same code, joined the same house, and both avatars appeared with 2 online.
- Reviewed screenshots at 1068×674 and 390×844; no mobile horizontal overflow after fixes.
- Inspected content route metadata; every content route has app-specific title/description and social metadata, including the new entry page.

## Limits and follow-ups
- The reported minute-long shared-preview hang was not reproduced locally. Auth/storage startup is a plausible wait source, not an established root cause. Generated storage/auth files were not edited. The new deadlines and explicit retries address the indefinite UI state.
- Camera faces and real two-device voice were not live-verified. Hook tests mock media. Existing LiveKit credential values were not inspected, printed, changed, or copied; the credential previously exposed must be rotated by the user in the provider account and saved through Project Settings → Secrets. No secrets should be pasted into chat.
- No publication was performed.
- The earlier deferred security items are addressed by the authenticated action/voice lease model below. Provider enforcement still needs real-device verification and autonomous cleanup remains a limitation.

## Changed files
- `src/components/orbit/AvatarVideo.tsx`, `FloorPlan.tsx`
- `src/hooks/useOrbitMedia.ts`, `useOrbitMedia.test.tsx`
- `src/lib/async-operation.ts`, `guest.ts`, `guest.test.ts`, `voice-session.ts`, `voice-session.test.ts`, `livekit.functions.ts`
- `src/routes/enter.tsx`, `index.tsx`, `create.tsx`, `create.test.tsx`, `join.$token.tsx`, `house.$houseId.tsx`
- Database migration: `drizzle/migrations/0001_idempotent_house_creation.sql` and tool-managed migration metadata
- Regenerated: `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`
- `AGENTS.md`, `roadmap.md`, `ORBIT_REVIEW.md`

## Privacy and media update — November 7, 2026

### Completed
- Voice issuance now requires the authenticated user's authorized, recently active current room. Moving clears room authorization and revokes old leases immediately; arrival must match the server-generated motion ID and minimum travel time. Private-room permission lookup failures deny access.
- Movement, presence, knocks, and approvals no longer consume arbitrary broadcast messages. Atomic authenticated RPCs derive the caller from auth, generate bounded wall-aware paths, reject unexpected identity fields, validate coordinates, and enforce room permissions. Activity/knock tables are read-only to clients; no frame-by-frame writes.
- Knock replies require an existing, unexpired request addressed to the current bedroom owner. Approval and grant creation happen together; forged `allowed`, `from`, `to`, and `uid` payloads cannot approve entry.
- Every door change clears old approvals and denies pending knocks. Open admits all house members; Knock requires fresh approval and evicts unapproved visitors; Locked is owner-only and evicts all visitors to Hallway. Changing the door and clearing approvals are atomic. Direct legacy door writes and grant inserts/deletes are no longer available to clients. Door controls explain these effects in their tooltips.
- Voice sessions use a unique lease identity, so old cleanup cannot remove a later session even after unmount/reentry. Tokens expire after 20 seconds and initially allow neither subscription nor publication. Only a successful authenticated post-connect permission check activates microphone-only voice; replaying the original stale token is inert. Lease checks recur every five seconds; house clients reconcile revoked/expired sessions every three seconds, including disabling permissions before removal. Revoked rows remain eligible for reconciliation through token expiry.
- Voice and video retry controls are independent. Voice retry leaves opted-in camera streaming untouched. Voice reconnect rechecks permission and resets the microphone to muted; camera/mic controls still require user choice, roll back failed permission requests, and reflect confirmed publication. Audio elements are cleared on disconnect/teardown. Phone controls wrap without horizontal overflow.

### Checks actually run
- `bunx vitest run`: **29 tests passed in 7 files**. Includes geometry/door fail-closed and locking-over-grants, auth/create safe retry, payload rejection, rapid A → hall → A teardown, stale join/unmount, failed teardown, camera/mic failure rollback, audio cleanup, voice-only retry preserving camera, lease-specific cleanup on reentry, revoked late join, and reconnect remaining muted.
- Saved live regression: `python3 tests/orbit_privacy_browser.py`. Two independent guest identities created/joined by house code, moved into Lounge, denied and approved knocks, entered Bedroom 1 after approval, and were evicted to Hallway when it locked. Existing voice lease authorization was revoked on lock. Direct authenticated attempts at locked movement, forged movement identity, out-of-bounds coordinates, forged approval, forged door identity, wrong-room voice, and early arrival were rejected by the actual database.
- Automatic preview build/typecheck reported **build OK**, including the final changes; no manual production build/typecheck was run because the platform runs these automatically.
- Reviewed desktop and 390 × 844 screenshots; no horizontal overflow. Browser run observed no page errors. New tables/functions were checked against the live database after migration.
- All content route metadata remains app-specific. No public deployment.

### Remaining limitations — do not treat mocked media as hardware verification
- LiveKit transport, real webcam rendering, microphone audio, permission removal, and token replay behavior have **not** been exercised with real devices or a live provider session in this update. Media tests mock the SDK. No existing credential values were inspected, printed, copied, or changed; code only references their configured names at runtime. The user must rotate the previously exposed credential in LiveKit and enter fresh values in Project Settings → Secrets, never chat.
- Revocation is durable immediately, but provider removal is driven by active house clients and their requests. There is no autonomous scheduled cleanup when every client closes, is suspended, or is malicious. A connected participant may outlive the 30-second lease unless a client invokes reconciliation. Provider/network errors can delay removal; inert replay tokens prevent new raw-token access, but do not replace autonomous removal for already activated sessions. This remains unfinished and needs a scheduled, authenticated reconciliation service plus live-provider acceptance testing.
- Previously issued legacy 10-minute voice tokens cannot be retroactively made inert by this code. Existing sessions/credentials should be invalidated during provider rotation before treating the new behavior as a complete privacy boundary.
- Browser runs created review houses/guest identities; they were not deleted. Presence flags are authenticated self-reports of confirmed client publication, not provider-attested proofs, and are not used for authorization.

### Real-device acceptance checklist
1. Rotate the exposed provider credential and securely update the configured values; use two devices with separate guest identities.
2. Join the same code. Opt into cameras; confirm faces on avatars and in the People dock. Enable voice, explicitly unmute, and verify only people in the same authorized room hear each other.
3. Move A → Hallway → A rapidly; leave/reenter during slow removal. Confirm no old voice leaks and old cleanup does not kick the new session.
4. Deny then allow a knock. Lock the occupied bedroom/change to Knock; confirm visitors move to Hallway and stop hearing/publishing promptly. Try reconnecting/replaying a revoked token; it must remain inert.
5. Deny device permissions, disconnect/reconnect the network, and retry voice while camera is on. Camera must keep streaming; reconnect must remain muted; errors must settle and be retryable on a phone.

### Files changed in this update
- `src/lib/house-actions.ts`, `house-actions.test.ts`, `voice-access.functions.ts`, `livekit.functions.ts`, `house.ts`, `house.test.ts`
- `src/hooks/useOrbitMedia.ts`, `useOrbitMedia.test.tsx`
- `src/routes/house.$houseId.tsx`, `src/components/ui/sonner.tsx`
- `tests/orbit_privacy_browser.py`
- Tool-managed migrations `0002_authoritative_house_actions.sql`, `0003_bound_motion_and_voice_replay.sql`, `0004_close_legacy_door_writes.sql`, their metadata, and regenerated client types
- `AGENTS.md`, `roadmap.md`, `ORBIT_REVIEW.md`