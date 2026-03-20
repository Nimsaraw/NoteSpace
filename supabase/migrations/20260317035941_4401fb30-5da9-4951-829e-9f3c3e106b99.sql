
-- Create security definer functions to break circular RLS
CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes WHERE id = _note_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_note_collaborator(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_collaborators WHERE note_id = _note_id AND collaborator_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_note_collaborator_with_edit(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_collaborators WHERE note_id = _note_id AND collaborator_user_id = _user_id AND can_edit = true
  )
$$;

-- Drop old recursive policies on notes
DROP POLICY IF EXISTS "Users can view collaborated notes" ON public.notes;
DROP POLICY IF EXISTS "Collaborators can update notes" ON public.notes;

-- Drop old recursive policy on note_collaborators
DROP POLICY IF EXISTS "Note owners can manage collaborators" ON public.note_collaborators;
DROP POLICY IF EXISTS "Collaborators can view their entries" ON public.note_collaborators;

-- Recreate notes policies using security definer functions
CREATE POLICY "Users can view collaborated notes" ON public.notes
  FOR SELECT TO authenticated
  USING (public.is_note_collaborator(id, auth.uid()));

CREATE POLICY "Collaborators can update notes" ON public.notes
  FOR UPDATE TO authenticated
  USING (public.is_note_collaborator_with_edit(id, auth.uid()));

-- Recreate note_collaborators policies using security definer functions
CREATE POLICY "Note owners can manage collaborators" ON public.note_collaborators
  FOR ALL TO authenticated
  USING (public.is_note_owner(note_id, auth.uid()));

CREATE POLICY "Collaborators can view their entries" ON public.note_collaborators
  FOR SELECT TO authenticated
  USING (collaborator_user_id = auth.uid());
