
-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Note collaborators table (created first, FK added after notes)
CREATE TABLE public.note_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL,
  collaborator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id, collaborator_user_id)
);

ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;

-- Notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Add FK and indexes
ALTER TABLE public.note_collaborators
  ADD CONSTRAINT fk_note_collaborators_note_id
  FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;

CREATE INDEX idx_notes_search ON public.notes USING GIN(search_vector);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_collaborators_note ON public.note_collaborators(note_id);
CREATE INDEX idx_collaborators_user ON public.note_collaborators(collaborator_user_id);

-- Notes RLS policies
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view collaborated notes"
  ON public.notes FOR SELECT TO authenticated
  USING (id IN (SELECT note_id FROM public.note_collaborators WHERE collaborator_user_id = auth.uid()));

CREATE POLICY "Users can create notes"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Collaborators can update notes"
  ON public.notes FOR UPDATE TO authenticated
  USING (id IN (SELECT note_id FROM public.note_collaborators WHERE collaborator_user_id = auth.uid() AND can_edit = true));

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Collaborator RLS policies
CREATE POLICY "Note owners can manage collaborators"
  ON public.note_collaborators FOR ALL TO authenticated
  USING (note_id IN (SELECT id FROM public.notes WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can view their entries"
  ON public.note_collaborators FOR SELECT TO authenticated
  USING (collaborator_user_id = auth.uid());
