ALTER TABLE public.house_activity ADD COLUMN motion_ready_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.voice_leases ADD COLUMN token_expires_at timestamptz NOT NULL DEFAULT now()+interval '25 seconds';
CREATE OR REPLACE FUNCTION public.orbit_activity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb; px double precision; py double precision; distance double precision:=0; BEGIN
 IF NEW.motion_id<>OLD.motion_id AND jsonb_array_length(NEW.path)>0 THEN
  px:=OLD.x; py:=OLD.y;
  FOR p IN SELECT value FROM jsonb_array_elements(NEW.path) LOOP
   distance:=distance+sqrt(power((p->>'x')::double precision-px,2)+power((p->>'y')::double precision-py,2));
   px:=(p->>'x')::double precision; py:=(p->>'y')::double precision;
  END LOOP;
  NEW.motion_ready_at:=now()+distance/280*interval '1 second';
 ELSIF jsonb_array_length(OLD.path)>0 AND jsonb_array_length(NEW.path)=0 AND NEW.motion_id=OLD.motion_id AND NEW.room_key IS NOT NULL AND now()<OLD.motion_ready_at THEN
  RAISE EXCEPTION 'Movement has not arrived yet';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orbit_motion_timing BEFORE UPDATE ON public.house_activity FOR EACH ROW EXECUTE FUNCTION public.orbit_activity_guard();
REVOKE ALL ON FUNCTION public.orbit_activity_guard() FROM PUBLIC,anon,authenticated;