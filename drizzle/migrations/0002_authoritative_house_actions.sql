CREATE TABLE public.house_activity (
 house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, x double precision NOT NULL DEFAULT 600, y double precision NOT NULL DEFAULT 380,
 room_key text, path jsonb NOT NULL DEFAULT '[]', motion_id uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'available', cam boolean NOT NULL DEFAULT false, mic boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(house_id,user_id)
);
GRANT SELECT ON public.house_activity TO authenticated;
GRANT ALL ON public.house_activity TO service_role;
ALTER TABLE public.house_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read authorized activity" ON public.house_activity FOR SELECT TO authenticated USING(public.is_house_member(house_id));
CREATE TABLE public.house_knocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL, owner_id uuid NOT NULL, room_key text NOT NULL,
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','allowed','denied')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.house_knocks TO authenticated;
GRANT ALL ON public.house_knocks TO service_role;
ALTER TABLE public.house_knocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read knocks" ON public.house_knocks FOR SELECT TO authenticated USING(public.is_house_member(house_id) AND (sender_id=auth.uid() OR owner_id=auth.uid()));
CREATE TABLE public.voice_leases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, room_key text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 seconds',
 revoked boolean NOT NULL DEFAULT false, removed boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.voice_leases TO authenticated;
GRANT ALL ON public.voice_leases TO service_role;
ALTER TABLE public.voice_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own voice leases" ON public.voice_leases FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_house_member(house_id));
CREATE INDEX voice_lease_house ON public.voice_leases(house_id) WHERE NOT removed;
CREATE OR REPLACE FUNCTION public.orbit_room(_x double precision,_y double precision) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN _x BETWEEN 40 AND 1160 AND _y BETWEEN 340 AND 420 THEN 'hallway'
 WHEN _x BETWEEN 40 AND 580 AND _y BETWEEN 40 AND 340 THEN 'bedroom1'
 WHEN _x BETWEEN 620 AND 1160 AND _y BETWEEN 40 AND 340 THEN 'bedroom2'
 WHEN _x BETWEEN 40 AND 660 AND _y BETWEEN 420 AND 740 THEN 'lounge'
 WHEN _x BETWEEN 700 AND 1160 AND _y BETWEEN 420 AND 740 THEN 'kitchen' END
$$;
CREATE OR REPLACE FUNCTION public.orbit_access(_house uuid,_user uuid,_room text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM house_members WHERE house_id=_house AND user_id=_user) AND
 CASE WHEN _room IN ('hallway','lounge','kitchen') THEN true
 WHEN _room IN ('bedroom1','bedroom2') THEN EXISTS(SELECT 1 FROM room_doors d WHERE d.house_id=_house AND d.room_key=_room AND
 (d.owner_id=_user OR d.state='open' OR (d.state='knock' AND EXISTS(SELECT 1 FROM door_grants g WHERE g.house_id=_house AND g.room_key=_room AND g.user_id=_user)))) ELSE false END
$$;
CREATE OR REPLACE FUNCTION public.orbit_invalidate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h uuid; BEGIN
 h := COALESCE(NEW.house_id,OLD.house_id);
 UPDATE voice_leases l SET revoked=true WHERE l.house_id=h AND NOT l.removed AND
 (NOT orbit_access(h,l.user_id,l.room_key) OR NOT EXISTS(SELECT 1 FROM house_activity a WHERE a.house_id=h AND a.user_id=l.user_id AND a.room_key=l.room_key AND a.updated_at>now()-interval '30 seconds'));
 UPDATE house_activity a SET room_key='hallway',x=600,y=380,path='[]',motion_id=gen_random_uuid(),mic=false
 WHERE a.house_id=h AND a.room_key IS NOT NULL AND NOT orbit_access(h,a.user_id,a.room_key);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER orbit_door_revocation AFTER UPDATE ON public.room_doors FOR EACH ROW EXECUTE FUNCTION public.orbit_invalidate();
CREATE TRIGGER orbit_grant_revocation AFTER DELETE ON public.door_grants FOR EACH ROW EXECUTE FUNCTION public.orbit_invalidate();
CREATE TRIGGER orbit_member_revocation AFTER DELETE ON public.house_members FOR EACH ROW EXECUTE FUNCTION public.orbit_invalidate();
CREATE OR REPLACE FUNCTION public.orbit_action(_house uuid,_action text,_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); a house_activity; d room_doors; k house_knocks; r text; p jsonb:='[]'; tx double precision; ty double precision; cx double precision; cy double precision; dest text; mid uuid; own text;
BEGIN
 IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0));
 SELECT * INTO a FROM house_activity WHERE house_id=_house AND user_id=u FOR UPDATE;
 IF _action='enter' THEN
  SELECT room_key INTO own FROM room_doors WHERE house_id=_house AND owner_id=u ORDER BY room_key LIMIT 1;
  INSERT INTO house_activity(house_id,user_id,x,y,room_key) VALUES(_house,u,CASE own WHEN 'bedroom1' THEN 230 WHEN 'bedroom2' THEN 970 ELSE 600 END,CASE WHEN own IS NULL THEN 380 ELSE 230 END,COALESCE(own,'hallway'))
  ON CONFLICT(house_id,user_id) DO UPDATE SET updated_at=now(),mic=false,cam=false;
 ELSIF _action='move' THEN
  IF a.user_id IS NULL THEN RAISE EXCEPTION 'Enter house first'; END IF;
  IF _payload - ARRAY['x','y'] <> '{}'::jsonb OR jsonb_typeof(_payload->'x')<>'number' OR jsonb_typeof(_payload->'y')<>'number' THEN RAISE EXCEPTION 'Invalid movement'; END IF;
  tx:=(_payload->>'x')::double precision; ty:=(_payload->>'y')::double precision; dest:=orbit_room(tx,ty);
  IF dest IS NULL OR NOT orbit_access(_house,u,dest) THEN RAISE EXCEPTION 'Room access denied: knock or ask the owner'; END IF;
  tx:=CASE dest WHEN 'bedroom1' THEN greatest(66,least(554,tx)) WHEN 'bedroom2' THEN greatest(646,least(1134,tx)) WHEN 'lounge' THEN greatest(66,least(634,tx)) WHEN 'kitchen' THEN greatest(726,least(1134,tx)) ELSE greatest(66,least(1134,tx)) END;
  ty:=CASE WHEN dest LIKE 'bedroom%' THEN greatest(66,least(314,ty)) WHEN dest='hallway' THEN greatest(366,least(394,ty)) ELSE greatest(446,least(714,ty)) END;
  r:=orbit_room(a.x,a.y);
  IF r<>dest THEN
   IF r<>'hallway' THEN cx:=CASE r WHEN 'bedroom1' THEN 480 WHEN 'bedroom2' THEN 720 WHEN 'lounge' THEN 290 ELSE 900 END; cy:=CASE WHEN r LIKE 'bedroom%' THEN 306 ELSE 454 END;
    p:=p||jsonb_build_array(jsonb_build_object('x',cx,'y',cy),jsonb_build_object('x',cx,'y',380)); END IF;
   IF dest<>'hallway' THEN cx:=CASE dest WHEN 'bedroom1' THEN 480 WHEN 'bedroom2' THEN 720 WHEN 'lounge' THEN 290 ELSE 900 END; cy:=CASE WHEN dest LIKE 'bedroom%' THEN 306 ELSE 454 END;
    p:=p||jsonb_build_array(jsonb_build_object('x',cx,'y',380),jsonb_build_object('x',cx,'y',cy)); END IF;
  END IF;
  p:=p||jsonb_build_array(jsonb_build_object('x',tx,'y',ty)); mid:=gen_random_uuid();
  UPDATE house_activity SET path=p,motion_id=mid,room_key=NULL,mic=false,updated_at=now() WHERE house_id=_house AND user_id=u;
  UPDATE voice_leases SET revoked=true WHERE house_id=_house AND user_id=u AND NOT removed;
 ELSIF _action='arrive' THEN
  IF _payload - ARRAY['motionId'] <> '{}'::jsonb OR (_payload->>'motionId')::uuid<>a.motion_id THEN RAISE EXCEPTION 'Stale movement'; END IF;
  IF jsonb_array_length(a.path)>0 THEN
   tx:=(a.path->-1->>'x')::double precision; ty:=(a.path->-1->>'y')::double precision; dest:=orbit_room(tx,ty);
   IF NOT orbit_access(_house,u,dest) THEN RAISE EXCEPTION 'Room permission changed'; END IF;
   UPDATE house_activity SET x=tx,y=ty,room_key=dest,path='[]',updated_at=now() WHERE house_id=_house AND user_id=u;
  END IF;
 ELSIF _action='heartbeat' THEN
  IF _payload - ARRAY['status','cam','mic'] <> '{}'::jsonb OR NOT (_payload->>'status'=ANY(ARRAY['available','working','dnd','away'])) OR jsonb_typeof(_payload->'cam')<>'boolean' OR jsonb_typeof(_payload->'mic')<>'boolean' THEN RAISE EXCEPTION 'Invalid presence'; END IF;
  UPDATE house_activity SET status=_payload->>'status',cam=(_payload->>'cam')::boolean,mic=(_payload->>'mic')::boolean,updated_at=now() WHERE house_id=_house AND user_id=u;
 ELSIF _action='leave' THEN
  UPDATE house_activity SET updated_at=now()-interval '1 day',room_key=NULL,path='[]',cam=false,mic=false WHERE house_id=_house AND user_id=u;
  UPDATE voice_leases SET revoked=true WHERE house_id=_house AND user_id=u AND NOT removed;
 ELSIF _action='knock' THEN
  IF _payload - ARRAY['room'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid knock'; END IF;
  SELECT * INTO d FROM room_doors WHERE house_id=_house AND room_key=_payload->>'room';
  IF d.owner_id IS NULL OR d.owner_id=u OR d.state<>'knock' THEN RAISE EXCEPTION 'This door is not accepting knocks'; END IF;
  IF EXISTS(SELECT 1 FROM house_knocks WHERE house_id=_house AND sender_id=u AND created_at>now()-interval '2 seconds') THEN RAISE EXCEPTION 'Please wait before knocking again'; END IF;
  INSERT INTO house_knocks(house_id,sender_id,owner_id,room_key) VALUES(_house,u,d.owner_id,d.room_key) RETURNING * INTO k;
  RETURN to_jsonb(k);
 ELSIF _action='reply' THEN
  IF _payload - ARRAY['id','allow'] <> '{}'::jsonb OR jsonb_typeof(_payload->'allow')<>'boolean' THEN RAISE EXCEPTION 'Invalid reply'; END IF;
  SELECT * INTO k FROM house_knocks WHERE id=(_payload->>'id')::uuid AND house_id=_house FOR UPDATE;
  SELECT * INTO d FROM room_doors WHERE house_id=_house AND room_key=k.room_key;
  IF k.owner_id IS DISTINCT FROM u OR d.owner_id IS DISTINCT FROM u OR k.decision<>'pending' OR k.created_at<now()-interval '60 seconds' THEN RAISE EXCEPTION 'Knock reply not authorized or expired'; END IF;
  IF (_payload->>'allow')::boolean AND d.state<>'knock' THEN RAISE EXCEPTION 'Door no longer accepts knocks'; END IF;
  IF (_payload->>'allow')::boolean THEN INSERT INTO door_grants(house_id,room_key,user_id) VALUES(_house,k.room_key,k.sender_id) ON CONFLICT DO NOTHING; END IF;
  UPDATE house_knocks SET decision=CASE WHEN (_payload->>'allow')::boolean THEN 'allowed' ELSE 'denied' END WHERE id=k.id;
 ELSIF _action='door' THEN
  IF _payload - ARRAY['state'] <> '{}'::jsonb OR NOT (_payload->>'state'=ANY(ARRAY['open','knock','locked'])) THEN RAISE EXCEPTION 'Invalid door state'; END IF;
  SELECT * INTO d FROM room_doors WHERE house_id=_house AND owner_id=u;
  IF d.owner_id IS NULL THEN RAISE EXCEPTION 'Only the bedroom owner can change its door'; END IF;
  UPDATE room_doors SET state=_payload->>'state' WHERE house_id=_house AND room_key=d.room_key;
  DELETE FROM door_grants WHERE house_id=_house AND room_key=d.room_key;
  UPDATE house_knocks SET decision='denied' WHERE house_id=_house AND room_key=d.room_key AND decision='pending';
 ELSE RAISE EXCEPTION 'Unknown house action'; END IF;
 SELECT * INTO a FROM house_activity WHERE house_id=_house AND user_id=u;
 RETURN to_jsonb(a);
END $$;
CREATE OR REPLACE FUNCTION public.orbit_voice(_house uuid,_action text,_room text DEFAULT NULL,_lease uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); a house_activity; l voice_leases; BEGIN
 IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0));
 SELECT * INTO a FROM house_activity WHERE house_id=_house AND user_id=u;
 IF _action='reserve' THEN
  IF _room NOT IN ('bedroom1','bedroom2','lounge','kitchen') OR a.room_key IS DISTINCT FROM _room OR a.updated_at<now()-interval '30 seconds' OR NOT orbit_access(_house,u,_room) THEN RAISE EXCEPTION 'Voice requires your authorized current room'; END IF;
  UPDATE voice_leases SET revoked=true WHERE house_id=_house AND user_id=u AND NOT removed;
  INSERT INTO voice_leases(house_id,user_id,room_key) VALUES(_house,u,_room) RETURNING * INTO l;
 ELSIF _action='check' THEN
  SELECT * INTO l FROM voice_leases WHERE id=_lease AND house_id=_house AND user_id=u;
  IF l.id IS NULL OR l.revoked OR l.removed OR l.expires_at<now() OR a.room_key IS DISTINCT FROM l.room_key OR a.updated_at<now()-interval '30 seconds' OR NOT orbit_access(_house,u,l.room_key) THEN RAISE EXCEPTION 'Voice permission expired or revoked'; END IF;
  UPDATE voice_leases SET expires_at=now()+interval '30 seconds' WHERE id=l.id RETURNING * INTO l;
 ELSIF _action='revoke' THEN
  UPDATE voice_leases SET revoked=true WHERE id=_lease AND house_id=_house AND user_id=u RETURNING * INTO l;
 ELSE RAISE EXCEPTION 'Invalid voice action'; END IF;
 RETURN to_jsonb(l);
END $$;
REVOKE UPDATE ON public.room_doors FROM authenticated;
REVOKE INSERT,DELETE ON public.door_grants FROM authenticated;
REVOKE ALL ON FUNCTION public.orbit_action(uuid,text,jsonb),public.orbit_voice(uuid,text,text,uuid),public.orbit_access(uuid,uuid,text),public.orbit_invalidate() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orbit_action(uuid,text,jsonb),public.orbit_voice(uuid,text,text,uuid) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.house_activity,public.house_knocks,public.voice_leases;