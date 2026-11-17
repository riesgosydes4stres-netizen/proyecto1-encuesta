import { describe, expect, it } from "vitest";
import { withMunicipalQuestions } from "@/lib/municipal-questions";
import { prepareNewDraft, withSavedSurveyDefaults } from "@/lib/survey-defaults";
import type { Question } from "@/lib/survey-parser";

describe("Municipal questions in all surveys", () => {
  it.each(["manual", "imported", "AI", "saved"])("includes all service choices in %s surveys", (source) => {
    const input: Question[] = [{ id: "existing", type: "short", text: "Observación", req: false, opts: [] }];
    const questions = source === "saved" ? withSavedSurveyDefaults(input) : prepareNewDraft({ title: source, desc: "", questions: input }).questions;
    expect(questions.find((q) => q.id === "municipal-services")).toMatchObject({ type: "multi", opts: ["Deportivo", "Salud", "Emprendimiento", "Cuidado Familiar", "Otro"] });
    expect(questions.find((q) => q.id === "municipal-services-other")?.type).toBe("short");
    expect(input).toHaveLength(1);
    expect(questions.find((q) => q.id === "existing")).toEqual(input[0]);
  });

  it("uses a single yes/no choice for municipal awareness", () => {
    expect(withMunicipalQuestions([]).find((q) => q.id === "municipal-awareness")).toMatchObject({ type: "single", opts: ["Sí", "No"] });
  });

  it("keeps IDs stable and does not duplicate questions on reopening", () => {
    const original: Question[] = [{ id: "municipal-services", type: "short", text: "Pregunta anterior", req: false, opts: [] }];
    const first = withMunicipalQuestions(original);
    expect(first.find((q) => q.type === "multi")?.id).toBe("municipal-services-1");
    expect(withMunicipalQuestions(original)).toEqual(first);
    expect(withMunicipalQuestions(first)).toEqual(first);
    expect(withSavedSurveyDefaults(prepareNewDraft({ title: "", desc: "", questions: [] }).questions).filter((q) => q.id.startsWith("municipal-"))).toHaveLength(3);
  });
});