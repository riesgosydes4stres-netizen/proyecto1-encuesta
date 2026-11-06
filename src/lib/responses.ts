import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Question } from "./survey-parser";
import { normalizeQuestions } from "./surveys";
import { householdCode, splitMedia, type Answers } from "./vulnerability";

export interface StoredResponse {
  id: string;
  survey_id: string;
  household_code: string;
  answers: Answers;
  created_at: string;
}

export interface PreviousResponse extends StoredResponse {
  questions: Question[];
  surveyTitle: string;
}

function randomToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const asAnswers = (v: unknown): Answers => (v && typeof v === "object" && !Array.isArray(v) ? (v as Answers) : {});

/** Saves a response to a published survey. Works without an account. */
export async function submitResponse(surveyId: string, questions: Question[], all: Answers) {
  const id = crypto.randomUUID();
  const token = randomToken();
  const { answers, media } = splitMedia(questions, all);
  const code = householdCode(questions, all);
  const { error } = await supabase.from("survey_responses").insert({
    id,
    survey_id: surveyId,
    household_code: code,
    answers: answers as unknown as Json,
    media: media as unknown as Json,
    share_token: token,
    owner_id: "00000000-0000-0000-0000-000000000000", // replaced by the database with the survey owner
  });
  if (error) {
    console.error(error);
    throw new Error(error.message.includes("no está disponible") ? "La encuesta ya no recibe respuestas." : "No se pudieron guardar las respuestas. Intente de nuevo.");
  }
  return { id, token, code, createdAt: new Date().toISOString() };
}

export async function listResponses(surveyId: string): Promise<StoredResponse[]> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id,survey_id,household_code,answers,created_at")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las respuestas.");
  return (data ?? []).map((r) => ({ ...r, answers: asAnswers(r.answers) }));
}

export async function getResponseMedia(id: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("survey_responses").select("media").eq("id", id).maybeSingle();
  if (error || !data) return {};
  const m = data.media;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return Object.fromEntries(Object.entries(m).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Latest earlier response of the same household among the owner's surveys (RLS limits it to the owner). */
export async function findPrevious(code: string, beforeIso: string, excludeId: string): Promise<PreviousResponse | null> {
  if (!code) return null;
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id,survey_id,household_code,answers,created_at,surveys(title,questions)")
    .eq("household_code", code)
    .neq("id", excludeId)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const s = data.surveys as { title: string; questions: Json } | null;
  return {
    id: data.id,
    survey_id: data.survey_id,
    household_code: data.household_code,
    answers: asAnswers(data.answers),
    created_at: data.created_at,
    questions: normalizeQuestions(s?.questions),
    surveyTitle: s?.title ?? "",
  };
}

export async function deleteResponse(id: string): Promise<void> {
  const { error } = await supabase.from("survey_responses").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar la respuesta.");
}
