ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS document_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS organization text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipality text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_personal_lengths CHECK (
    char_length(name) <= 120 AND char_length(document_type) <= 10 AND char_length(document_number) <= 30
    AND char_length(phone) <= 30 AND char_length(position) <= 120
    AND char_length(organization) <= 160 AND char_length(municipality) <= 120
  );

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;