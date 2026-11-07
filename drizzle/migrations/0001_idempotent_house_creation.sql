ALTER TABLE public.houses ADD COLUMN creation_request uuid;
CREATE UNIQUE INDEX houses_creation_request_unique ON public.houses(created_by, creation_request) WHERE creation_request IS NOT NULL;
ALTER TABLE public.house_invites ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(8), 'hex');
CREATE OR REPLACE FUNCTION public.create_house_once(_name text, _display_name text, _color text, _request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
 IF _request_id IS NULL THEN RAISE EXCEPTION 'request id required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || _request_id::text, 0));
 SELECT id INTO _id FROM public.houses WHERE created_by = _uid AND creation_request = _request_id;
 IF _id IS NOT NULL THEN RETURN _id; END IF;
 IF length(trim(_name)) NOT BETWEEN 1 AND 60 OR length(trim(_display_name)) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Enter a house name and your name'; END IF;
 _id := public.create_house(_name, _display_name, _color);
 UPDATE public.houses SET creation_request = _request_id WHERE id = _id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_house_once(text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_house_once(text,text,text,uuid) TO authenticated, service_role;