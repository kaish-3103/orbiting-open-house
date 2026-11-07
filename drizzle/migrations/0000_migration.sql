
CREATE TABLE public.houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  template text NOT NULL DEFAULT 'founders_loft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.house_members (
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT 'sage',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (house_id, user_id)
);
CREATE TABLE public.house_invites (
  token text PRIMARY KEY DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.room_doors (
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  room_key text NOT NULL,
  owner_id uuid,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','knock','locked')),
  PRIMARY KEY (house_id, room_key)
);
CREATE TABLE public.door_grants (
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  room_key text NOT NULL,
  user_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (house_id, room_key, user_id)
);

GRANT SELECT ON public.houses, public.house_members, public.house_invites, public.room_doors, public.door_grants TO authenticated;
GRANT UPDATE (display_name, color) ON public.house_members TO authenticated;
GRANT UPDATE (state) ON public.room_doors TO authenticated;
GRANT INSERT, DELETE ON public.door_grants TO authenticated;
GRANT ALL ON public.houses, public.house_members, public.house_invites, public.room_doors, public.door_grants TO service_role;

ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_house_member(_house uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.house_members WHERE house_id = _house AND user_id = auth.uid())
$$;

CREATE POLICY "members read house" ON public.houses FOR SELECT TO authenticated USING (public.is_house_member(id));
CREATE POLICY "members read members" ON public.house_members FOR SELECT TO authenticated USING (public.is_house_member(house_id));
CREATE POLICY "edit own membership" ON public.house_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "members read invites" ON public.house_invites FOR SELECT TO authenticated USING (public.is_house_member(house_id));
CREATE POLICY "members read doors" ON public.room_doors FOR SELECT TO authenticated USING (public.is_house_member(house_id));
CREATE POLICY "owner sets door" ON public.room_doors FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "members read grants" ON public.door_grants FOR SELECT TO authenticated USING (public.is_house_member(house_id));
CREATE POLICY "owner grants" ON public.door_grants FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.room_doors d WHERE d.house_id = door_grants.house_id AND d.room_key = door_grants.room_key AND d.owner_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.house_members m WHERE m.house_id = door_grants.house_id AND m.user_id = door_grants.user_id));
CREATE POLICY "owner or self revokes" ON public.door_grants FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.room_doors d WHERE d.house_id = door_grants.house_id AND d.room_key = door_grants.room_key AND d.owner_id = auth.uid()));

-- Create a house: caller becomes member + owner of bedroom1
CREATE OR REPLACE FUNCTION public.create_house(_name text, _display_name text, _color text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO houses(name, created_by) VALUES (trim(_name), _uid) RETURNING id INTO _id;
  INSERT INTO house_members(house_id, user_id, display_name, color) VALUES (_id, _uid, trim(_display_name), _color);
  INSERT INTO house_invites(house_id, created_by) VALUES (_id, _uid);
  INSERT INTO room_doors(house_id, room_key, owner_id) VALUES (_id, 'bedroom1', _uid), (_id, 'bedroom2', NULL);
  RETURN _id;
END $$;

-- Preview an invite (house name only) without being a member
CREATE OR REPLACE FUNCTION public.invite_preview(_token text)
RETURNS TABLE(house_id uuid, house_name text, member_count int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.name, (SELECT count(*)::int FROM house_members m WHERE m.house_id = h.id)
  FROM house_invites i JOIN houses h ON h.id = i.house_id
  WHERE i.token = _token AND NOT i.revoked
$$;

-- Join through an invite; claims a free bedroom if any
CREATE OR REPLACE FUNCTION public.join_house(_token text, _display_name text, _color text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _hid uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT i.house_id INTO _hid FROM house_invites i WHERE i.token = _token AND NOT i.revoked;
  IF _hid IS NULL THEN RAISE EXCEPTION 'invite not valid'; END IF;
  IF (SELECT count(*) FROM house_members WHERE house_id = _hid) >= 8 AND NOT EXISTS (SELECT 1 FROM house_members WHERE house_id=_hid AND user_id=_uid) THEN
    RAISE EXCEPTION 'house is full';
  END IF;
  INSERT INTO house_members(house_id, user_id, display_name, color) VALUES (_hid, _uid, trim(_display_name), _color)
  ON CONFLICT (house_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name, color = EXCLUDED.color;
  IF NOT EXISTS (SELECT 1 FROM room_doors WHERE house_id=_hid AND owner_id=_uid) THEN
    UPDATE room_doors SET owner_id = _uid
    WHERE house_id=_hid AND room_key = (SELECT room_key FROM room_doors WHERE house_id=_hid AND owner_id IS NULL ORDER BY room_key LIMIT 1);
  END IF;
  RETURN _hid;
END $$;

REVOKE ALL ON FUNCTION public.create_house(text,text,text), public.join_house(text,text,text), public.invite_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_house(text,text,text), public.join_house(text,text,text), public.invite_preview(text), public.is_house_member(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_doors, public.house_members, public.door_grants;

-- Private realtime channels: topic 'house:<uuid>' only for that house's members
CREATE POLICY "house members receive" ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() LIKE 'house:%' AND public.is_house_member(nullif(substring(realtime.topic() from 7), '')::uuid));
CREATE POLICY "house members send" ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() LIKE 'house:%' AND public.is_house_member(nullif(substring(realtime.topic() from 7), '')::uuid));
