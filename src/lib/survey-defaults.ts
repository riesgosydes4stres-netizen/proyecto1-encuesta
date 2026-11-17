import { uid, type Question, type SurveyDoc } from "./survey-parser";
import { withIndexDefaults } from "./vulnerability";
import { withMunicipalQuestions } from "./municipal-questions";

/** Keep ordinary questions first, then all signatures and finally all photos; preserve IDs and values. */
export function withMediaLast(questions: Question[]): Question[] {
  return [
    ...questions.filter((q) => q.type !== "signature" && q.type !== "photo"),
    ...questions.filter((q) => q.type === "signature"),
    ...questions.filter((q) => q.type === "photo"),
  ];
}

/** Adds respondent media to new drafts without duplicating supplied fields. */
export function withRespondentFields(doc: SurveyDoc, fieldId: (type: "signature" | "photo") => string = uid): SurveyDoc {
  const questions = [...doc.questions];
  for (const field of [
    { type: "signature" as const, text: "Firma de la persona encuestada" },
    { type: "photo" as const, text: "Foto de la persona encuestada" },
  ]) {
    if (!questions.some((q) => q.type === field.type)) {
      questions.push({ id: fieldId(field.type), ...field, req: false, sec: "Firma y fotografía", opts: [] });
    }
  }
  return { ...doc, questions: withMediaLast(questions) };
}

/** Read-time compatibility for saved surveys; stable IDs keep media readable without rewriting old data. */
export function withSavedRespondentFields(questions: Question[]): Question[] {
  const ids = new Set(questions.map((q) => q.id));
  return withRespondentFields({ title: "", desc: "", questions }, (type) => {
    const base = `respondent-${type}`;
    let id = base;
    let suffix = 1;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    return id;
  }).questions;
}

/** All saved survey surfaces share the same questions without mutating historical data. */
export function withSavedSurveyDefaults(questions: Question[]): Question[] {
  return withMediaLast(withMunicipalQuestions(withSavedRespondentFields(questions)));
}

/** Every new draft: signature + photo, index components and the household code for the cruce. */
export function prepareNewDraft(doc: SurveyDoc): SurveyDoc {
  const prepared = withIndexDefaults(withRespondentFields(doc));
  return { ...prepared, questions: withMediaLast(withMunicipalQuestions(prepared.questions)) };
}
