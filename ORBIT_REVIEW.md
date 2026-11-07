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
- Deferred security design, as requested: voice tokens check house membership and bedroom doors but do not verify authoritative current-room location. Movement and knock broadcasts trust identity fields in their payloads. An authenticated sender binding and authoritative room transition model are needed before treating these broadcasts as security boundaries.

## Changed files
- `src/components/orbit/AvatarVideo.tsx`, `FloorPlan.tsx`
- `src/hooks/useOrbitMedia.ts`, `useOrbitMedia.test.tsx`
- `src/lib/async-operation.ts`, `guest.ts`, `guest.test.ts`, `voice-session.ts`, `voice-session.test.ts`, `livekit.functions.ts`
- `src/routes/enter.tsx`, `index.tsx`, `create.tsx`, `create.test.tsx`, `join.$token.tsx`, `house.$houseId.tsx`
- Database migration: `drizzle/migrations/0001_idempotent_house_creation.sql` and tool-managed migration metadata
- Regenerated: `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`
- `AGENTS.md`, `roadmap.md`, `ORBIT_REVIEW.md`