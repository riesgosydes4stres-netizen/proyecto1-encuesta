ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '{}'::jsonb;

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
  IF pg_column_size(NEW.answers) > 500000 THEN
    RAISE EXCEPTION 'La respuesta es demasiado grande.';
  END IF;
  IF pg_column_size(NEW.media) > 4000000 THEN
    RAISE EXCEPTION 'La foto o la firma son demasiado grandes.';
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