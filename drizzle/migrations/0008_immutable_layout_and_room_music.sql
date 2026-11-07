ALTER TABLE public.houses ADD COLUMN layout_key text NOT NULL DEFAULT 'loft' CHECK(layout_key IN ('loft','lounge','office'));
CREATE FUNCTION public.orbit_fixed_layout() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.layout_key IS DISTINCT FROM OLD.layout_key THEN RAISE EXCEPTION 'House layout is fixed after creation'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fixed_house_layout BEFORE UPDATE ON public.houses FOR EACH ROW EXECUTE FUNCTION public.orbit_fixed_layout();
CREATE FUNCTION public.create_house_layout(_name text,_display_name text,_color text,_request_id uuid,_layout text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); h uuid; token text; BEGIN
IF u IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Sign in and retry'; END IF;
IF _layout NOT IN ('loft','lounge','office') OR _layout IS NULL THEN RAISE EXCEPTION 'Choose a valid layout'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(u::text||_request_id::text,0)); SELECT id INTO h FROM houses WHERE created_by=u AND creation_request=_request_id; IF h IS NOT NULL THEN RETURN h; END IF;
IF length(trim(_name)) NOT BETWEEN 1 AND 60 OR length(trim(_display_name)) NOT BETWEEN 1 AND 40 OR _color NOT IN ('sage','sky','lavender','honey','coral') THEN RAISE EXCEPTION 'Enter valid house and avatar details'; END IF;
INSERT INTO houses(name,created_by,creation_request,layout_key) VALUES(trim(_name),u,_request_id,_layout) RETURNING id INTO h;
INSERT INTO house_members(house_id,user_id,display_name,color) VALUES(h,u,trim(_display_name),_color);
INSERT INTO room_doors(house_id,room_key,owner_id,state) VALUES(h,'bedroom1',u,'open'),(h,'bedroom2',NULL,'open');
INSERT INTO house_invites(house_id,created_by) VALUES(h,u);
RETURN h; END $$;
REVOKE ALL ON FUNCTION public.create_house_layout(text,text,text,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.create_house_layout(text,text,text,uuid,text) TO authenticated;
ALTER TABLE public.house_activity ADD COLUMN room_entered_at timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION public.orbit_room_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF TG_OP='INSERT' OR NEW.room_key IS DISTINCT FROM OLD.room_key THEN NEW.room_entered_at:=clock_timestamp(); END IF; RETURN NEW; END $$;
CREATE TRIGGER activity_room_entry BEFORE INSERT OR UPDATE ON public.house_activity FOR EACH ROW EXECUTE FUNCTION public.orbit_room_entry();
CREATE TABLE public.room_music(house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,room_key text NOT NULL CHECK(room_key IN ('bedroom1','bedroom2','lounge','kitchen')),controller_id uuid,track text NOT NULL DEFAULT 'jazz' CHECK(track IN ('jazz','rain','classical','instrumental')),playing boolean NOT NULL DEFAULT false,started_at timestamptz NOT NULL DEFAULT now(),requests jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(house_id,room_key));
GRANT SELECT ON public.room_music TO authenticated; GRANT ALL ON public.room_music TO service_role;
ALTER TABLE public.room_music ENABLE ROW LEVEL SECURITY;
CREATE POLICY current_room_music ON public.room_music FOR SELECT TO authenticated USING(public.orbit_current(house_id,auth.uid(),room_key));
CREATE FUNCTION public.orbit_music(_house uuid,_action text DEFAULT 'snapshot',_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); r text; m room_music; c uuid; t uuid; BEGIN
IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0));
SELECT room_key INTO r FROM house_activity WHERE house_id=_house AND user_id=u;
IF r IS NULL OR r='hallway' OR NOT orbit_current(_house,u,r) THEN RAISE EXCEPTION 'Enter an authorized room for music'; END IF;
INSERT INTO room_music(house_id,room_key) VALUES(_house,r) ON CONFLICT DO NOTHING;
SELECT * INTO m FROM room_music WHERE house_id=_house AND room_key=r FOR UPDATE;
IF m.controller_id IS NULL OR NOT orbit_current(_house,m.controller_id,r) THEN
SELECT user_id INTO c FROM house_activity a WHERE house_id=_house AND room_key=r AND orbit_current(_house,a.user_id,r) ORDER BY room_entered_at,user_id LIMIT 1;
UPDATE room_music SET controller_id=c,requests='{}' WHERE house_id=_house AND room_key=r; m.controller_id:=c; m.requests:='{}'; END IF;
IF _action='set' THEN
IF m.controller_id<>u OR m.controller_id IS NULL THEN RAISE EXCEPTION 'Only the music controller can change tracks'; END IF;
IF _payload - ARRAY['track','playing'] <> '{}' OR NOT (_payload->>'track'=ANY(ARRAY['jazz','rain','classical','instrumental'])) OR jsonb_typeof(_payload->'playing')<>'boolean' THEN RAISE EXCEPTION 'Invalid music selection'; END IF;
UPDATE room_music SET track=_payload->>'track',playing=(_payload->>'playing')::boolean,started_at=now() WHERE house_id=_house AND room_key=r;
ELSIF _action='request' THEN
IF _payload<>'{}' OR m.controller_id=u THEN RAISE EXCEPTION 'Invalid control request'; END IF;
IF m.requests ? u::text THEN RAISE EXCEPTION 'Your request is already pending'; END IF;
UPDATE room_music SET requests=requests||jsonb_build_object(u::text,now()) WHERE house_id=_house AND room_key=r;
ELSIF _action='reply' THEN
IF m.controller_id<>u OR _payload - ARRAY['target','allow'] <> '{}' OR jsonb_typeof(_payload->'allow')<>'boolean' THEN RAISE EXCEPTION 'Only the controller can answer'; END IF;
t:=(_payload->>'target')::uuid;
IF NOT (m.requests ? t::text) OR NOT orbit_current(_house,t,r) THEN RAISE EXCEPTION 'Request expired or member left'; END IF;
UPDATE room_music SET controller_id=CASE WHEN (_payload->>'allow')::boolean THEN t ELSE controller_id END,requests=CASE WHEN (_payload->>'allow')::boolean THEN '{}'::jsonb ELSE requests-t::text END WHERE house_id=_house AND room_key=r;
ELSIF _action<>'snapshot' OR _payload<>'{}' THEN RAISE EXCEPTION 'Invalid music action'; END IF;
UPDATE room_music SET requests=COALESCE((SELECT jsonb_object_agg(key,value) FROM jsonb_each(requests) WHERE orbit_current(_house,key::uuid,r) AND (value#>>'{}')::timestamptz>now()-interval '2 minutes'),'{}') WHERE house_id=_house AND room_key=r;
SELECT * INTO m FROM room_music WHERE house_id=_house AND room_key=r;
RETURN to_jsonb(m)||jsonb_build_object('now',now()); END $$;
REVOKE ALL ON FUNCTION public.orbit_music(uuid,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.orbit_music(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.orbit_music_departure() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='DELETE' OR NEW.room_key IS DISTINCT FROM OLD.room_key OR NEW.updated_at<now()-interval '30 seconds' THEN
UPDATE room_music SET controller_id=NULL,requests='{}' WHERE house_id=OLD.house_id AND room_key=OLD.room_key AND controller_id=OLD.user_id;
END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER music_departure AFTER UPDATE OR DELETE ON public.house_activity FOR EACH ROW EXECUTE FUNCTION public.orbit_music_departure();