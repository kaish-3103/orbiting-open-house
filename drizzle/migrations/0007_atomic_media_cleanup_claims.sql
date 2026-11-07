ALTER TABLE public.voice_leases ADD COLUMN cleanup_attempt_at timestamptz;
CREATE INDEX voice_cleanup_pending ON public.voice_leases(cleanup_attempt_at) WHERE NOT removed;
CREATE OR REPLACE FUNCTION public.orbit_claim_media_cleanup(_house uuid DEFAULT NULL, _limit integer DEFAULT 50) RETURNS SETOF public.voice_leases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h uuid; BEGIN
 IF _limit<1 OR _limit>100 THEN RAISE EXCEPTION 'Invalid cleanup limit'; END IF;
 FOR h IN SELECT DISTINCT house_id FROM voice_leases WHERE NOT removed AND (_house IS NULL OR house_id=_house) ORDER BY house_id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(h::text,0));
 END LOOP;
 RETURN QUERY WITH candidates AS (
 SELECT l.id FROM voice_leases l WHERE NOT l.removed AND (_house IS NULL OR l.house_id=_house)
 AND (l.revoked OR l.expires_at<=now() OR NOT public.orbit_current(l.house_id,l.user_id,l.room_key))
 AND (l.cleanup_attempt_at IS NULL OR l.cleanup_attempt_at<=now()-interval '5 seconds')
 ORDER BY l.cleanup_attempt_at NULLS FIRST,l.expires_at,l.id LIMIT _limit FOR UPDATE OF l SKIP LOCKED
 ) UPDATE voice_leases l SET revoked=true,cleanup_attempt_at=now() FROM candidates c WHERE l.id=c.id RETURNING l.*;
END $$;
REVOKE ALL ON FUNCTION public.orbit_claim_media_cleanup(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_claim_media_cleanup(uuid,integer) TO service_role;
