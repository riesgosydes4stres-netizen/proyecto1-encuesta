import { uid, type SurveyDoc } from "./survey-parser";
import { withIndexDefaults } from "./vulnerability";

/** Adds respondent media to new drafts without duplicating supplied fields. */
export function withRespondentFields(doc: SurveyDoc): SurveyDoc {
  const questions = [...doc.questions];
  for (const field of [
    { type: "signature" as const, text: "Firma de la persona encuestada" },
    { type: "photo" as const, text: "Foto de la persona encuestada" },
  ]) {
    if (!questions.some((q) => q.type === field.type)) {
      questions.push({ id: uid(), ...field, req: false, sec: "Firma y fotografía", opts: [] });
    }
  }
  return { ...doc, questions };
}

/** Every new draft: signature + photo, index components and the household code for the cruce. */
export function prepareNewDraft(doc: SurveyDoc): SurveyDoc {
  return withIndexDefaults(withRespondentFields(doc));
}
