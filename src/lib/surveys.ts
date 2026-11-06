import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { uid, type Dimension, type Question, type QuestionType, type SurveyDoc } from "./survey-parser";

export interface SavedSurvey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  updated_at: string;
  is_published: boolean;
}

const TYPES: QuestionType[] = ["short", "date", "number", "grid", "select", "long", "single", "multi", "scale", "photo", "signature"];
const DIMS: Dimension[] = ["vivienda", "medios", "sst"];

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Normalizes questions from the DB or an uploaded .json (old Creador format included). */
export function normalizeQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
    .map((q) => {
      const type = TYPES.includes(q["type"] as QuestionType) ? (q["type"] as QuestionType) : "short";
      const out: Question = {
        id: typeof q["id"] === "string" ? q["id"] : uid(),
        type,
        text: typeof q["text"] === "string" ? q["text"] : "",
        req: q["req"] === true,
        sec: typeof q["sec"] === "string" ? q["sec"] : "",
        opts: strList(q["opts"]),
      };
      if (type === "grid") {
        out.rows = strList(q["rows"]);
        out.cols = strList(q["cols"]);
      }
      if (DIMS.includes(q["dim"] as Dimension)) out.dim = q["dim"] as Dimension;
      if (Array.isArray(q["risk"])) out.risk = (q["risk"] as unknown[]).map((v) => (typeof v === "number" ? v : 50));
      if (q["invert"] === true) out.invert = true;
      if (q["key"] === true) out.key = true;
      return out;
    });
}

export function surveyFromJson(data: unknown): SurveyDoc {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const questions = normalizeQuestions(d["questions"]);
  if (!questions.length) throw new Error("El archivo no contiene preguntas.");
  return {
    title: typeof d["title"] === "string" ? d["title"] : "Encuesta sin título",
    desc: typeof d["desc"] === "string" ? d["desc"] : typeof d["description"] === "string" ? (d["description"] as string) : "",
    questions,
  };
}

function cleanQuestions(qs: Question[]): Question[] {
  return qs
    .filter((q) => q.text.trim())
    .map(({ auto: _auto, ...q }) => q);
}

export async function listSurveys(userId: string): Promise<SavedSurvey[]> {
  // Published surveys from other people are readable too, so always filter by owner.
  const { data, error } = await supabase
    .from("surveys")
    .select("id,title,description,questions,updated_at,is_published")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar sus encuestas.");
  return (data ?? []).map((r) => ({ ...r, questions: normalizeQuestions(r.questions) }));
}

export async function getOwnSurvey(userId: string, id: string): Promise<SavedSurvey | null> {
  const { data, error } = await supabase
    .from("surveys")
    .select("id,title,description,questions,updated_at,is_published")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar la encuesta.");
  return data ? { ...data, questions: normalizeQuestions(data.questions) } : null;
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase.from("surveys").update({ is_published: published }).eq("id", id);
  if (error) throw new Error("No se pudo cambiar el estado de la encuesta.");
}

export const surveyLink = (id: string) =>
  (typeof window !== "undefined" ? window.location.origin : "") + "/responder/" + id;

export async function saveSurvey(userId: string, doc: SurveyDoc, id: string | null): Promise<string> {
  const row = {
    title: doc.title.trim() || "Encuesta sin título",
    description: doc.desc,
    questions: cleanQuestions(doc.questions) as unknown as Json,
  };
  if (id) {
    const { error } = await supabase.from("surveys").update(row).eq("id", id);
    if (error) throw new Error("No se pudo guardar la encuesta.");
    return id;
  }
  const { data, error } = await supabase
    .from("surveys")
    .insert({ ...row, user_id: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo guardar la encuesta.");
  return data.id;
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar la encuesta.");
}

export function downloadSurveyJson(doc: SurveyDoc, slug: string) {
  const data = { title: doc.title.trim() || "Encuesta sin título", desc: doc.desc, questions: cleanQuestions(doc.questions) };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = slug + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
