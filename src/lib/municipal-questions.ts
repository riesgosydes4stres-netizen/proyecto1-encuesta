import type { Question } from "./survey-parser";

const normalizeLabel = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Shared additions for every survey; deterministic IDs preserve answers across reads. */
export function withMunicipalQuestions(input: Question[]): Question[] {
  const questions = [...input];
  const ids = new Set(questions.map((q) => q.id));
  const fields: Omit<Question, "id">[] = [
    { type: "multi", text: "¿Qué tipo de servicios le gustaría que la Alcaldía le ofreciera?", opts: ["Deportivo", "Salud", "Emprendimiento", "Cuidado Familiar", "Otro"], req: false, sec: "Servicios del municipio" },
    { type: "short", text: "Otro servicio, ¿cuál?", opts: [], req: false, sec: "Servicios del municipio" },
    { type: "single", text: "¿Conoce la oferta y demanda que le ofrece el municipio?", opts: ["Sí", "No"], req: false, sec: "Servicios del municipio" },
  ];
  const keys = ["municipal-services", "municipal-services-other", "municipal-awareness"];
  fields.forEach((field, index) => {
    const base = keys[index];
    if (!base) return;
    if (questions.some((q) => normalizeLabel(q.text) === normalizeLabel(field.text))) return;
    let id = base;
    let suffix = 1;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    questions.push({ id, ...field });
  });
  return questions;
}