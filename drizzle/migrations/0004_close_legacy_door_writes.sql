REVOKE UPDATE (state) ON public.room_doors FROM authenticated;
COMMENT ON TABLE public.house_activity IS 'Authenticated RPC-owned room and motion authorization; render path locally, never frame writes.';
COMMENT ON TABLE public.voice_leases IS 'Lease-specific LiveKit identities; inert short tokens activated after permission check. Durable revocations require reconciliation.';