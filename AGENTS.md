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
- Avatar movement and knocks use authenticated atomic RPCs and read-only activity/knock rows; animate server-generated paths locally and never write animation frames, because broadcast payloads have no trusted sender identity.
- Voice/video use LiveKit with one camera-only house room and mic-only voice rooms; durable room authorization and lease-specific identities isolate stale cleanup, with short tokens and repeated revocation reconciliation to bound replay.
- Guests are anonymous auth users; houses are joined only through `join_house(token)` RPC so house IDs alone grant nothing.
- House creation retries use a persisted per-attempt UUID and `create_house_once`; enforce idempotency in the database so uncertain responses never create duplicates.
- Voice transitions use the serialized VoiceSession queue; await server removal before joining with the same identity, and keep teardown failures blocking retries.
- Media presence reflects confirmed publications, not requested toggles; avatar videos attach/detach the same tracks as the dock.
