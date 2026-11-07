CREATE TABLE public.house_visits (house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,user_id uuid NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,remembered boolean NOT NULL DEFAULT true,PRIMARY KEY(house_id,user_id));
GRANT SELECT ON public.house_visits TO authenticated; GRANT ALL ON public.house_visits TO service_role;
ALTER TABLE public.house_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_members ON public.house_visits FOR SELECT TO authenticated USING(is_house_member(house_id));
CREATE TABLE public.focus_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,host_id uuid NOT NULL,room_key text,focus_seconds integer NOT NULL,break_seconds integer NOT NULL DEFAULT 0,phase text NOT NULL DEFAULT 'focus',state text NOT NULL DEFAULT 'running',remaining_seconds double precision NOT NULL,deadline timestamptz,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.focus_sessions TO authenticated; GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY focus_members ON public.focus_sessions FOR SELECT TO authenticated USING(is_house_member(house_id) AND (room_key IS NOT NULL OR host_id=auth.uid()));
CREATE UNIQUE INDEX focus_one_room ON public.focus_sessions(house_id,room_key) WHERE room_key IS NOT NULL AND state<>'complete';
CREATE TABLE public.focus_participants (session_id uuid NOT NULL REFERENCES public.focus_sessions(id) ON DELETE CASCADE,user_id uuid NOT NULL,PRIMARY KEY(session_id,user_id));
GRANT SELECT ON public.focus_participants TO authenticated; GRANT ALL ON public.focus_participants TO service_role;
ALTER TABLE public.focus_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY focus_participant_read ON public.focus_participants FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.focus_sessions s WHERE s.id=session_id AND is_house_member(s.house_id)));
CREATE TABLE public.house_signals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,sender_id uuid NOT NULL,recipient_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('wave','invite')),room_key text,created_at timestamptz NOT NULL DEFAULT now(),handled boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.house_signals TO authenticated; GRANT ALL ON public.house_signals TO service_role;
ALTER TABLE public.house_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY signal_recipient ON public.house_signals FOR SELECT TO authenticated USING(is_house_member(house_id) AND (sender_id=auth.uid() OR recipient_id=auth.uid()));
CREATE TABLE public.room_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,room_key text NOT NULL,sender_id uuid NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.room_messages TO authenticated; GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.orbit_current(_house uuid,_user uuid,_room text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT orbit_access(_house,_user,_room) AND EXISTS(SELECT 1 FROM house_activity WHERE house_id=_house AND user_id=_user AND room_key=_room AND updated_at>now()-interval '30 seconds') $$;
REVOKE ALL ON FUNCTION public.orbit_current(uuid,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.orbit_current(uuid,uuid,text) TO authenticated,service_role;
CREATE POLICY room_message_current ON public.room_messages FOR SELECT TO authenticated USING(orbit_current(house_id,auth.uid(),room_key));
CREATE TABLE public.room_settings (house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,room_key text NOT NULL,name text NOT NULL,palette text NOT NULL DEFAULT 'sage',decor text NOT NULL DEFAULT 'plant',PRIMARY KEY(house_id,room_key));
GRANT SELECT ON public.room_settings TO authenticated; GRANT ALL ON public.room_settings TO service_role;
ALTER TABLE public.room_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_members ON public.room_settings FOR SELECT TO authenticated USING(is_house_member(house_id));
CREATE OR REPLACE FUNCTION public.orbit_visit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.updated_at<now()-interval '23 hours' AND NEW.room_key IS NULL THEN UPDATE house_visits SET ended_at=now() WHERE house_id=NEW.house_id AND user_id=NEW.user_id;
 ELSE INSERT INTO house_visits(house_id,user_id) VALUES(NEW.house_id,NEW.user_id) ON CONFLICT(house_id,user_id) DO UPDATE SET started_at=CASE WHEN house_visits.ended_at IS NOT NULL THEN now() ELSE house_visits.started_at END,ended_at=NULL; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER orbit_visit AFTER INSERT OR UPDATE OF updated_at ON public.house_activity FOR EACH ROW EXECUTE FUNCTION public.orbit_visit_guard();
CREATE OR REPLACE FUNCTION public.orbit_experience(_house uuid,_action text,_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); a house_activity; s focus_sessions; sid uuid; target uuid; room text; seconds integer; rest integer; BEGIN
 IF u IS NULL OR NOT is_house_member(_house) THEN RAISE EXCEPTION 'House access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_house::text,0));
 SELECT * INTO a FROM house_activity WHERE house_id=_house AND user_id=u;
 UPDATE focus_sessions SET phase='break',remaining_seconds=break_seconds,deadline=deadline+break_seconds*interval '1 second' WHERE house_id=_house AND state='running' AND phase='focus' AND break_seconds>0 AND deadline<=now();
 UPDATE focus_sessions SET state='complete',remaining_seconds=0,deadline=NULL WHERE house_id=_house AND state='running' AND deadline<=now();
 IF _action='snapshot' THEN
 RETURN jsonb_build_object('now',now(),'visits',COALESCE((SELECT jsonb_agg(v) FROM house_visits v WHERE house_id=_house),'[]'::jsonb),'timers',COALESCE((SELECT jsonb_agg(t) FROM focus_sessions t WHERE house_id=_house AND (t.room_key IS NOT NULL OR t.host_id=u) AND (t.state<>'complete' OR t.created_at>now()-interval '1 day')),'[]'::jsonb),'participants',COALESCE((SELECT jsonb_agg(p) FROM focus_participants p JOIN focus_sessions t ON t.id=p.session_id WHERE t.house_id=_house AND (t.room_key IS NOT NULL OR t.host_id=u)),'[]'::jsonb),'signals',COALESCE((SELECT jsonb_agg(n) FROM house_signals n WHERE house_id=_house AND recipient_id=u AND NOT handled AND created_at>now()-interval '1 minute'),'[]'::jsonb),'settings',COALESCE((SELECT jsonb_agg(r) FROM room_settings r WHERE house_id=_house),'[]'::jsonb),'messages',COALESCE((SELECT jsonb_agg(m ORDER BY m.created_at) FROM (SELECT * FROM room_messages WHERE house_id=_house AND room_key=a.room_key AND orbit_current(_house,u,room_key) ORDER BY created_at DESC LIMIT 50) m),'[]'::jsonb));
 ELSIF _action='forget' THEN UPDATE house_visits SET remembered=false WHERE house_id=_house AND user_id=u;
 ELSIF _action='remember' THEN UPDATE house_visits SET remembered=true WHERE house_id=_house AND user_id=u;
 ELSIF _action='start' THEN
 IF _payload-ARRAY['seconds','break','shared']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid timer'; END IF;
 seconds:=(_payload->>'seconds')::integer; rest:=COALESCE((_payload->>'break')::integer,0);
 IF seconds IS NULL OR seconds NOT BETWEEN 60 AND 14400 OR rest NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'Focus must be 1–240 minutes; break 0–60 minutes'; END IF;
 IF (_payload->>'shared')::boolean THEN IF a.room_key IS NULL OR a.room_key='hallway' OR NOT orbit_current(_house,u,a.room_key) THEN RAISE EXCEPTION 'Enter an authorized room to share focus'; END IF; room:=a.room_key;
 ELSE UPDATE focus_sessions SET state='complete',deadline=NULL WHERE house_id=_house AND host_id=u AND room_key IS NULL AND state<>'complete'; END IF;
 INSERT INTO focus_sessions(house_id,host_id,room_key,focus_seconds,break_seconds,remaining_seconds,deadline) VALUES(_house,u,room,seconds,rest,seconds,now()+seconds*interval '1 second') RETURNING id INTO sid;
 INSERT INTO focus_participants VALUES(sid,u);
 ELSIF _action IN ('pause','resume','reset','join','leave_focus','claim') THEN
 IF _payload-ARRAY['id']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid timer action'; END IF;
 SELECT * INTO s FROM focus_sessions WHERE id=(_payload->>'id')::uuid AND house_id=_house FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Timer not found'; END IF;
 IF s.room_key IS NOT NULL AND NOT orbit_current(_house,u,s.room_key) AND _action<>'leave_focus' THEN RAISE EXCEPTION 'Enter this room first'; END IF;
 IF s.room_key IS NULL AND s.host_id<>u THEN RAISE EXCEPTION 'Personal timer is private'; END IF;
 IF _action='join' THEN IF s.state='complete' THEN RAISE EXCEPTION 'Timer completed'; END IF; INSERT INTO focus_participants VALUES(s.id,u) ON CONFLICT DO NOTHING;
 ELSIF _action='leave_focus' THEN DELETE FROM focus_participants WHERE session_id=s.id AND user_id=u;
 ELSIF _action='claim' THEN IF orbit_current(_house,s.host_id,s.room_key) AND EXISTS(SELECT 1 FROM focus_participants WHERE session_id=s.id AND user_id=s.host_id) THEN RAISE EXCEPTION 'Host is still here'; END IF; UPDATE focus_sessions SET host_id=u WHERE id=s.id; INSERT INTO focus_participants VALUES(s.id,u) ON CONFLICT DO NOTHING;
 ELSE IF s.host_id<>u THEN RAISE EXCEPTION 'Only the host controls this timer'; END IF;
 IF _action='pause' AND s.state='running' THEN UPDATE focus_sessions SET state='paused',remaining_seconds=greatest(0,extract(epoch FROM deadline-now())),deadline=NULL WHERE id=s.id;
 ELSIF _action='resume' AND s.state='paused' THEN UPDATE focus_sessions SET state='running',deadline=now()+remaining_seconds*interval '1 second' WHERE id=s.id;
 ELSIF _action='reset' THEN UPDATE focus_sessions SET state='paused',phase='focus',remaining_seconds=focus_seconds,deadline=NULL WHERE id=s.id; END IF; END IF;
 ELSIF _action IN ('wave','invite') THEN
 IF _payload-ARRAY['target']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid signal'; END IF; target:=(_payload->>'target')::uuid;
 IF target=u OR NOT EXISTS(SELECT 1 FROM house_activity WHERE house_id=_house AND user_id=target AND updated_at>now()-interval '30 seconds' AND status<>'dnd') THEN RAISE EXCEPTION 'They are unavailable or do not want interruptions'; END IF;
 IF a.updated_at<now()-interval '30 seconds' THEN RAISE EXCEPTION 'Reconnect first'; END IF;
 IF EXISTS(SELECT 1 FROM house_signals WHERE house_id=_house AND sender_id=u AND created_at>now()-interval '5 seconds') THEN RAISE EXCEPTION 'Wait 5 seconds before another wave or invitation'; END IF;
 IF _action='invite' AND (a.room_key IS NULL OR a.room_key='hallway' OR NOT orbit_current(_house,u,a.room_key)) THEN RAISE EXCEPTION 'Enter a room first'; END IF;
 INSERT INTO house_signals(house_id,sender_id,recipient_id,kind,room_key) VALUES(_house,u,target,_action,CASE WHEN _action='invite' THEN a.room_key END);
 ELSIF _action='dismiss' THEN UPDATE house_signals SET handled=true WHERE id=(_payload->>'id')::uuid AND recipient_id=u AND house_id=_house;
 ELSIF _action='message' THEN
 IF _payload-ARRAY['body']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid message'; END IF;
 IF a.room_key IS NULL OR a.room_key='hallway' OR NOT orbit_current(_house,u,a.room_key) THEN RAISE EXCEPTION 'Room access required'; END IF;
 IF length(trim(_payload->>'body')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Message must be 1–1000 characters'; END IF;
 IF EXISTS(SELECT 1 FROM room_messages WHERE house_id=_house AND sender_id=u AND created_at>now()-interval '2 seconds') THEN RAISE EXCEPTION 'Wait 2 seconds before sending again'; END IF;
 INSERT INTO room_messages(house_id,room_key,sender_id,body) VALUES(_house,a.room_key,u,trim(_payload->>'body'));
 ELSIF _action='decorate' THEN
 IF _payload-ARRAY['name','palette','decor']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid room settings'; END IF;
 SELECT room_key INTO room FROM room_doors WHERE house_id=_house AND owner_id=u LIMIT 1;
 IF room IS NULL THEN RAISE EXCEPTION 'Only the bedroom owner can customize'; END IF;
 IF length(trim(_payload->>'name')) NOT BETWEEN 1 AND 24 OR (_payload->>'palette') NOT IN ('sage','sky','lavender','honey','coral') OR (_payload->>'decor') NOT IN ('plant','books','cushions') THEN RAISE EXCEPTION 'Choose a name and curated decor'; END IF;
 INSERT INTO room_settings VALUES(_house,room,trim(_payload->>'name'),_payload->>'palette',_payload->>'decor') ON CONFLICT(house_id,room_key) DO UPDATE SET name=EXCLUDED.name,palette=EXCLUDED.palette,decor=EXCLUDED.decor;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF; RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.orbit_experience(uuid,text,jsonb),public.orbit_visit_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orbit_experience(uuid,text,jsonb) TO authenticated;
CREATE INDEX room_messages_history ON public.room_messages(house_id,room_key,created_at DESC);
CREATE INDEX house_signal_rate ON public.house_signals(house_id,sender_id,created_at DESC);