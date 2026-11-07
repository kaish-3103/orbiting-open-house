<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Orbit architecture
- House geometry, pathing and door rules live in `src/lib/house.ts` (pure, unit-tested); the SVG plan only renders it.
- The client-only 3D house maps the same authoritative plan coordinates through `house-scene`; furniture is visual only, and lazy loading preserves SSR and the SVG loading fallback.
- House layout is immutable database state chosen at creation; reversible layout-coordinate transforms reshape floors, walls, doors, furniture and avatars while authoritative canonical room authorization stays unchanged.
- Room music uses authenticated atomic RPCs, durable room-entry ordering and controller transfer; playback is local opt-in and stops on failed room authorization.
- Avatar movement and knocks use authenticated atomic RPCs and read-only activity/knock rows; animate server-generated paths locally and never write animation frames, because broadcast payloads have no trusted sender identity.
- Media uses separate camera-only house, microphone-only voice and screen-only room transports; typed durable leases and unique identities isolate cleanup and keep private screens out of house video.
- Guests are anonymous auth users; houses are joined only through `join_house(token)` RPC so house IDs alone grant nothing.
- House creation retries use a persisted per-attempt UUID and `create_house_once`; enforce idempotency in the database so uncertain responses never create duplicates.
- Voice transitions use the serialized VoiceSession queue; await server removal before joining with the same identity, and keep teardown failures blocking retries.
- Media presence reflects confirmed publications, not requested toggles; avatar videos attach/detach the same tracks as the dock.
- Focus, visits, social signals, chat and decoration mutate only through authenticated atomic experience RPCs; server deadlines synchronize timers and current-room authorization restricts message reads.
- Autonomous media cleanup uses generated cron authentication and a managed minute schedule; claim/revoke stale leases atomically under the same house lock as renewal, rotate retry attempts and remove only lease-specific identities. Deployment/provider acceptance remains required before calling it operational.
- Microphone publication requests serialize per voice connection; explicit Muted clicks may connect and unmute, while reconnection and voice retry reset to muted.
