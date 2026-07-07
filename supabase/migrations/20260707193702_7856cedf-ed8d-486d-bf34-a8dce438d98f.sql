
-- Trainer profile
CREATE TABLE public.trainer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_profiles TO authenticated;
GRANT ALL ON public.trainer_profiles TO service_role;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer read own" ON public.trainer_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "trainer insert own" ON public.trainer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "trainer update own" ON public.trainer_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer manage own groups" ON public.groups FOR ALL TO authenticated USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- Players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  player_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_group_idx ON public.players(group_id);
CREATE INDEX players_code_idx ON public.players(player_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer manage own players" ON public.players FOR ALL TO authenticated USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- Events (training + game)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('training','game')),
  title TEXT NOT NULL,
  opponent TEXT,
  home_away TEXT CHECK (home_away IN ('home','away')),
  location TEXT,
  meeting_point TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_group_idx ON public.events(group_id);
CREATE INDEX events_date_idx ON public.events(event_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer manage own events" ON public.events FOR ALL TO authenticated USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- Attendances
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('accepted','declined','pending')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, player_id)
);
CREATE INDEX attendances_event_idx ON public.attendances(event_id);
CREATE INDEX attendances_player_idx ON public.attendances(player_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT ALL ON public.attendances TO service_role;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer manage own attendances" ON public.attendances FOR ALL TO authenticated USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- Auto-create attendance rows when event is created
CREATE OR REPLACE FUNCTION public.create_attendances_for_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendances (event_id, player_id, trainer_id, status)
  SELECT NEW.id, p.id, NEW.trainer_id, 'pending'
  FROM public.players p
  WHERE p.group_id = NEW.group_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_create_attendances
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.create_attendances_for_event();

-- When new player is added, create attendance rows for future events of that group
CREATE OR REPLACE FUNCTION public.create_attendances_for_new_player()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendances (event_id, player_id, trainer_id, status)
  SELECT e.id, NEW.id, NEW.trainer_id, 'pending'
  FROM public.events e
  WHERE e.group_id = NEW.group_id AND e.event_at >= now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_create_attendances_new_player
AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.create_attendances_for_new_player();

-- Auto-create trainer profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_trainer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.trainer_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_trainer
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_trainer();
