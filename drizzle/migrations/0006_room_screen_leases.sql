ALTER TABLE public.voice_leases ADD COLUMN media_kind text NOT NULL DEFAULT 'voice';
ALTER TABLE public.voice_leases ADD COLUMN is_sharer boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX one_room_screen ON public.voice_leases(house_id,room_key) WHERE media_kind='screen' AND is_sharer AND NOT revoked AND NOT removed;
CREATE OR REPLACE FUNCTION public.orbit_screen(_house uuid,_action text,_room text DEFAULT NULL,_lease uuid DEFAULT NULL,_share boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); l voice_leases; BEGIN
 IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0));
 IF _action='reserve' THEN
 IF _room NOT IN ('bedroom1','bedroom2','lounge','kitchen') OR NOT orbit_current(_house,u,_room) THEN RAISE EXCEPTION 'Screen audience requires authorized current room'; END IF;
 UPDATE voice_leases SET revoked=true WHERE house_id=_house AND media_kind='screen' AND NOT removed AND (expires_at<=now() OR NOT orbit_current(_house,user_id,room_key) OR user_id=u);
 IF _share AND EXISTS(SELECT 1 FROM voice_leases WHERE house_id=_house AND room_key=_room AND media_kind='screen' AND is_sharer AND NOT revoked AND NOT removed) THEN RAISE EXCEPTION 'Someone is already sharing in this room'; END IF;
 INSERT INTO voice_leases(house_id,user_id,room_key,media_kind,is_sharer) VALUES(_house,u,_room,'screen',_share) RETURNING * INTO l;
 ELSIF _action='check' THEN
 SELECT * INTO l FROM voice_leases WHERE id=_lease AND house_id=_house AND user_id=u AND media_kind='screen';
 IF l.id IS NULL OR l.revoked OR l.removed OR l.expires_at<=now() OR NOT orbit_current(_house,u,l.room_key) THEN RAISE EXCEPTION 'Screen access revoked'; END IF;
 UPDATE voice_leases SET expires_at=now()+interval '30 seconds' WHERE id=l.id RETURNING * INTO l;
 ELSIF _action='revoke' THEN UPDATE voice_leases SET revoked=true WHERE id=_lease AND house_id=_house AND user_id=u AND media_kind='screen' RETURNING * INTO l;
 ELSE RAISE EXCEPTION 'Invalid screen action'; END IF; RETURN to_jsonb(l); END $$;
REVOKE ALL ON FUNCTION public.orbit_screen(uuid,text,text,uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.orbit_screen(uuid,text,text,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.orbit_voice(_house uuid,_action text,_room text DEFAULT NULL,_lease uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); a house_activity; l voice_leases; BEGIN
 IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0)); SELECT * INTO a FROM house_activity WHERE house_id=_house AND user_id=u;
 IF _action='reserve' THEN
 IF _room NOT IN ('bedroom1','bedroom2','lounge','kitchen') OR a.room_key IS DISTINCT FROM _room OR a.updated_at<now()-interval '30 seconds' OR NOT orbit_access(_house,u,_room) THEN RAISE EXCEPTION 'Voice requires your authorized current room'; END IF;
 UPDATE voice_leases SET revoked=true WHERE house_id=_house AND user_id=u AND media_kind='voice' AND NOT removed;
 INSERT INTO voice_leases(house_id,user_id,room_key) VALUES(_house,u,_room) RETURNING * INTO l;
 ELSIF _action='check' THEN SELECT * INTO l FROM voice_leases WHERE id=_lease AND house_id=_house AND user_id=u AND media_kind='voice';
 IF l.id IS NULL OR l.revoked OR l.removed OR l.expires_at<now() OR a.room_key IS DISTINCT FROM l.room_key OR a.updated_at<now()-interval '30 seconds' OR NOT orbit_access(_house,u,l.room_key) THEN RAISE EXCEPTION 'Voice permission expired or revoked'; END IF;
 UPDATE voice_leases SET expires_at=now()+interval '30 seconds' WHERE id=l.id RETURNING * INTO l;
 ELSIF _action='revoke' THEN UPDATE voice_leases SET revoked=true WHERE id=_lease AND house_id=_house AND user_id=u AND media_kind='voice' RETURNING * INTO l;
 ELSE RAISE EXCEPTION 'Invalid voice action'; END IF; RETURN to_jsonb(l); END $$;