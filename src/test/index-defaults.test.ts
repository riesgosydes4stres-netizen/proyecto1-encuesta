import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/survey-parser";
import { computeIndex, suggestDimension, withIndexDefaults } from "@/lib/vulnerability";
import { prepareNewDraft } from "@/lib/survey-defaults";

const q = (p: Partial<Question> & Pick<Question, "id" | "type" | "text">): Question => ({ req: false, opts: [], ...p });

describe("Automatic index setup for new surveys", () => {
  it("assigns housing, livelihood and SST questions to their component", () => {
    expect(suggestDimension({ text: "¿De qué material es el techo de la vivienda?" })).toBe("vivienda");
    expect(suggestDimension({ text: "¿Cuál es la principal fuente de ingresos del hogar?" })).toBe("medios");
    expect(suggestDimension({ text: "¿Usa elementos de protección personal al trabajar?" })).toBe("sst");
  });

  it("produces an IVT right after answering a new draft", () => {
    const doc = prepareNewDraft({ title: "Hogar", desc: "", questions: [
      q({ id: "a", type: "single", text: "Estado del techo de la vivienda", opts: ["Bueno", "Regular", "Malo"] }),
      q({ id: "b", type: "single", text: "¿Tiene empleo formal?", opts: ["Sí", "No"] }),
      q({ id: "c", type: "single", text: "¿Ha tenido accidentes de trabajo?", opts: ["Sí", "No"] }),
    ] });
    const idx = computeIndex(doc.questions, { a: "Malo", b: "No", c: "Sí" });
    expect(idx.dims).toEqual({ vivienda: 100, medios: 100, sst: 100 });
    expect(idx.ivt).toBe(100);
  });

  it("adds a household code question for the cruce when none exists", () => {
    const doc = withIndexDefaults({ title: "", desc: "", questions: [] });
    expect(doc.questions.filter((x) => x.key)).toHaveLength(1);
    expect(doc.questions[0]?.text).toBe("Código del hogar");
  });

  it("marks an existing household code question instead of adding another", () => {
    const doc = withIndexDefaults({ title: "", desc: "", questions: [q({ id: "k", type: "short", text: "Código del hogar beneficiario" })] });
    expect(doc.questions).toHaveLength(1);
    expect(doc.questions[0]?.key).toBe(true);
  });

  it("never overrides a component the user already chose", () => {
    const doc = withIndexDefaults({ title: "", desc: "", questions: [
      q({ id: "x", type: "single", text: "Ingresos del hogar", opts: ["Sí", "No"], dim: "sst" }),
    ] });
    expect(doc.questions.find((x) => x.id === "x")?.dim).toBe("sst");
  });
});
