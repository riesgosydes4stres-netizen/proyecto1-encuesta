ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.surveys TO anon;
CREATE POLICY "Anyone reads published surveys" ON public.surveys
  FOR SELECT TO anon, authenticated USING (is_published = true);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  household_code text NOT NULL DEFAULT '',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by uuid,
  share_token text NOT NULL,
  email_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX survey_responses_owner_household_idx ON public.survey_responses (owner_id, household_code, created_at DESC);
CREATE INDEX survey_responses_survey_idx ON public.survey_responses (survey_id, created_at DESC);

GRANT INSERT ON public.survey_responses TO anon;
GRANT SELECT, INSERT, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone answers published surveys" ON public.survey_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.is_published = true));

CREATE POLICY "Owners read responses" ON public.survey_responses
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete responses" ON public.survey_responses
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.prepare_survey_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.surveys WHERE id = NEW.survey_id AND is_published = true;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'La encuesta no está disponible para recibir respuestas.';
  END IF;
  IF pg_column_size(NEW.answers) > 4000000 THEN
    RAISE EXCEPTION 'La respuesta es demasiado grande.';
  END IF;
  IF length(NEW.share_token) < 20 OR length(NEW.share_token) > 128 THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;
  NEW.owner_id := v_owner;
  NEW.submitted_by := auth.uid();
  NEW.household_code := left(lower(trim(coalesce(NEW.household_code, ''))), 120);
  NEW.email_count := 0;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER survey_responses_prepare
  BEFORE INSERT ON public.survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.prepare_survey_response();