# Orbit review

## Shared music and permanent layouts — November 7
- Creation now offers Loft, Social Lounge and Cooperative Office. Database layout is fixed after insertion; uncertain retries return the original house without changing it. Existing houses default to Loft. Visitors have no layout switch.
- Layouts now reshape room widths/depths, corridor placement, walls and door openings, not only colors. Reversible transforms map furniture, avatars and clicks to the unchanged server-authorized room graph. Lounge emphasizes the lower social floor; Office deepens cabins and compacts meeting areas. These are different proportions of the same five-room connectivity, not new permission graphs.
- Four original synthesized 48-second loops (jazz-inspired, rain, classical-style and instrumental) are bundled locally. No third-party commercial songs. Room controller chooses track and shared play/pause; each person explicitly listens and controls their own volume.
- Authenticated RPCs select the earliest currently authorized arrival, retain control until transfer/departure, handle requests and approval/decline, and reject non-controller changes. Departure/revocation clears control; remaining participants elect the earliest arrival. Closed browsers expire from current presence after 30 seconds. Pending requests expire after two minutes.
- Playback uses server start timestamps and stops/clears when room lookup fails or the user leaves. Shared pause currently stops playback; play restarts the loop (not resume at saved offset).
- Two independent browser identities created/joined by code, moved using authenticated movement/arrival, played rain with actual audio-element progress, rejected a guest's forged track change, requested/transferred control, changed to jazz, and verified departure denial and controller fallback. Phone width fitted and no page errors occurred. Media camera transport displayed a connection failure; webcam/voice remains unverified and unchanged.
- Focused tests cover coordinate inversion/different proportions, four-track validation, late-listener loop position and owner-selected creation/retry. Build/typecheck: OK. Browser audio playback verified, but listening quality on physical speakers/headphones is not verified. No publication or secret access.

## 3D visual update
- Added real interactive Three.js rendering, CC0 furniture models, wood floor detail, windows, warm lights and shadows. The original server geometry/doors remain unchanged.
- Original local style selectors were superseded by the permanent creation-time layouts described above.
- Verified joined-house avatar profile, actual canvas walking into Lounge with server readback, reset control and phone width. Software WebGL made walking slow; device frame rate remains unverified. Check the preview on your device, rotate the house and walk between rooms.
- Ten focused geometry, coordinate mapping and avatar tests passed. Automatic build/typecheck reports build OK. Both new styles rendered without page errors, including phone selector checks.
- Shared music has now been implemented as described above.
- No publication or credential inspection/change.

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

## Focus and social expansion — November 7, 2026

### Implemented
- Personal timers: 25/5, 50/10, custom 1–240 minute focus and optional 0–60 minute break; start/pause/resume/reset, remaining versus elapsed, paused state and focusing-until display. Shared room timers use database deadlines, explicit host-only controls, opt-in participants, independent leave and explicit takeover when host leaves/disconnects. Refresh/background rendering derives from timestamps with server clock offset, never accumulated ticks. No timer activates camera/mic; completion is silent (no sound setting added).
- Accessible avatar cards from SVG click/tap/Enter/Space, dock and phone People list. Avatar interaction stops floor movement. Cards show name/color, current room/status, current visit duration and shared timer state; offline members are labeled disconnected. Disclosure explains fellow-member visibility. Optional bio/pronouns were not added.
- Current visit is one latest server-owned row per member/house, preserving brief reconnect and refresh; explicit leave ends it and re-entry replaces its start. No work-time claim, device tracking or productivity scoring. Recent houses persist for the guest identity, recheck membership, and support Forget without saving invite credentials. Clearing guest browser storage limitations are disclosed.
- Waves/invitations are authenticated recipient notifications with 5-second shared rate limit and DND denial. Accept follows normal movement/knock/locked rules, not teleportation or an implicit grant.
- Persisted room chat: authenticated sender, 1–1000 characters, 2-second send rate, timestamps, safely rendered text and unread indicator. Only currently authorized participants fetch the latest 50 messages, including messages from before their arrival. Polling stops the old room on transition, clears old content immediately and clears on errors/revocation. No broadcast chat channel leaks restricted messages.
- Bedroom owner customization persists/synchronizes name (24-character limit), palette and curated plant/books/cushions decoration; path and door geometry unchanged.
- Screen code: explicit browser chooser, no audio/recording, separate screen-only room transport, one active sharer lease per room, opt-in viewers, Stop sharing/viewing, browser-ended handling and server current-room lease checks. Movement and locks revoke typed leases. Camera transport is independent.
- Listener indicator queries provider participants/subscribe permissions after server current-room authorization; unknown/reconnecting is explicit and it never derives "no listeners" from missing presence. House camera versus room voice/screens is labeled.
- Dismissible onboarding and phone-accessible tools/profile dialogs; media remains off initially.
- Authenticated autonomous cleanup handler and managed schedule `orbit-autonomous-media-cleanup` every minute are created. Cleanup evaluates current authorization/expiry, disables permissions before removal, retains failed removals for retry, and handles both voice and screen identities. Unauthenticated local request returned 401.

### Checks actually run
- `bunx vitest run`: **37 tests passed in 10 files**. New tests cover presets, late/background deadline calculation, break completion, paused refresh, visit elapsed semantics, avatar click/keyboard versus movement, stale cleanup without browsers, revocation and ordered/retryable provider removal. Existing mocked voice-only retry preserving camera tests still pass.
- Two fresh independent browser guests: create/join, movement, avatar profile without changing server motion ID, Wave delivered, shared focus join, nonhost pause rejected, pause/resume, participant leave without stopping others, persisted chat readable on both, DND denial, cleared chat/wrong-room timer denial, screen lease revoked on movement, synchronized owner decor, recent-house re-entry and refresh visit preservation. Saved repeatable flow: `tests/orbit_features_browser.py`.
- Existing two-identity privacy browser regression passed: denied/allowed knocks, bedroom lock eviction, voice lease revocation, forged payload/identity denial and early-arrival denial.
- Reviewed timer dialog and 390×844 house/People screenshots; no horizontal overflow. No page errors in successful feature/privacy runs. Latest automatic build reports build OK. All content routes retain unique Orbit metadata.
- Live migrations 0005/0006 were exercised through the authenticated browser RPCs; schedule metadata was listed and confirmed active.

### Honest incomplete / blocked items
- **No publication occurred.** The schedule targets the published callback, so with no published app it is prepared, not an operationally verified cleanup service. After explicitly approved deployment and provider credential rotation, verify actual scheduled requests/removal before considering the old autonomous-cleanup privacy gap closed. Minute scheduling is not immediate removal; worst-case wait approaches a minute plus provider/network latency, and failed requests retry on later runs. Batch limit is 200 leases; large backlogs need further validation.
- No existing LiveKit secret values were inspected, printed, copied or modified. Runtime functions reference configured names only. The previously exposed credential still requires user rotation in provider settings and secure replacement in Project Settings → Secrets, never chat.
- Real camera/mic/screens, connected-listener names, screen reconnect/browser-ended behavior and provider token replay/removal have not been verified with rotated credentials and real devices. Unit media/cleanup tests mock provider calls; screen authorization browser checks test real database leases, not transmitted screens.
- Exhaustive non-media edge acceptance (host takeover after all clients close, custom timer completion across reconnect, repeated-wave/chat-rate boundaries, invitation acceptance at locked doors, unauthorized recent-house re-entry and Forget) was not fully exercised. The server rules exist but these are not claimed tested. No optional completion-sound control or optional bio/pronouns fields were added.
- Polling provides room/social updates on roughly a two-second cadence and permissions/activity on the existing cadence, not instantaneous delivery. Completed focus rows remain stored; no historical timer dashboard/scoring was added, but a retention policy remains to be selected.

### Two-device acceptance
1. Rotate credentials securely; after separately approved deployment, verify scheduled cleanup runs when both browsers close.
2. Join one house on two devices; inspect cards, shared focus pause/resume/leave/takeover, waves/DND and room chat.
3. Enable camera explicitly; retry voice and rapidly move A→hall→A. Confirm camera persists and reconnect stays muted; listener names reflect actual voice connections.
4. Share a screen explicitly, view from the same authorized room, reject a second sharer, then move/lock the bedroom and use browser Stop Sharing; confirm screen and voice removal while camera remains on.
5. Check phone controls, denied permissions/network retry, late join/refresh timer completion and guest re-entry/Forget.

### Changed files
- New: `FocusPanel`, `HouseCompanion`, `ScreenSharing`, `Audience`, avatar interaction test; focus/experience/cleanup helpers and tests; screen/audience server functions; media cleanup server helper and protected callback.
- Updated: house and enter routes, FloorPlan, voice reconciliation, architecture/checklist/review; tool-generated migrations 0005/0006, migration metadata, types and route tree. Existing unrelated files preserved.

## Mute button and atomic cleanup — November 7, 2026
- **Mute control fixed:** it was disabled whenever room voice was off, forcing users to discover the separate auto-connect switch. An explicit Muted click now connects voice in the authorized room and requests microphone publication. Hallway clicks explain that a room is required; failures settle with retry. Label/pressed state reflects confirmed publication. Mute/unmute requests serialize per connection so a slow old enable cannot overtake a newer mute; permission failure permits retry. Voice retry/reconnection resets microphone choice to muted and does not restart camera.
- **Cleanup implementation hardened:** new service-role-only `orbit_claim_media_cleanup` atomically re-evaluates stale authorization/expiry and revokes under the same house advisory lock as renewals, movement and doors. A lease renewed first is not claimed based on an old snapshot; a claimed revoked lease cannot renew. Cleanup and member reconciliation now share this path. It selects only actionable leases, rotates failed attempts, performs up to four batches of 50 concurrently and skips recent claims for five seconds. This prevents active rows/failed first-page entries starving later stale rows. Provider permission disable precedes removal, addressing only `user:lease` identities in the correctly typed room. Completion persistence is conditional on revoked state. New sessions have separate identities and are not targeted by old cleanup.
- Rows remain retryable until original token expiry, intentionally permitting another disable/removal if an inert unexpired token rejoins. This is not a claim that original tokens can be invalidated at the provider. Network failures remain retryable; minute cadence and callback/provider latency do not guarantee instant removal.
- **Validation:** full `bunx vitest run`: 44 tests passed in 12 files; microphone enable→mute, delayed enable versus mute, permission retry, atomic-claim failure blocking provider calls, lease-specific old/new isolation, failed removal retention, further-page drain and screen namespace added. Media provider behavior is mocked. Real browser at 1068×674 created a house, moved to Lounge, confirmed enabled Muted control, clicked it and observed auto-connect enabled and actionable Retry voice after deliberately blocking token requests (no live provider call). Cleanup unauthenticated POST returned 401. Live database privilege inspection confirmed only service_role can execute the claim function; no anonymous/member access. Automatic preview reports build OK.
- **Still blocked, not complete operationally:** existing every-minute managed schedule is active, but its callback remains unpublished per the user's no-publication requirement. No autonomous provider invocation/removal has been verified. Actual microphone audio also requires rotated credentials and two-device acceptance. Existing credential values were not inspected, printed, copied or changed. Rotate in LiveKit and update Project Settings → Secrets, never chat. No publication performed.
- **Acceptance after authorized deployment/rotation:** two devices in one room, explicitly unmute/mute and confirm audio; keep camera on through voice retry; move A→hall→A, lock/remove access, close all clients and verify scheduled old-lease removal without kicking the new lease. Measure removal latency and simulate provider failure/retry.
- Changed: `useOrbitMedia`/tests, house route, microphone helper/tests, cleanup server helper/tests, voice reconciliation, tool-managed migration 0007/types, AGENTS/checklist/review.