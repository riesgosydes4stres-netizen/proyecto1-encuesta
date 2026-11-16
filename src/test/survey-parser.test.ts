import { describe, expect, it } from "vitest";
import { EJEMPLO, iaPedido, parse, slugify } from "@/lib/survey-parser";
import { surveyFromJson } from "@/lib/surveys";
import { MAX_PROMPT_CHARS, validatePrompt } from "@/lib/ai.functions";

describe("survey parser (ported from the original app)", () => {
  const doc = parse(EJEMPLO);

  it("reads title and description from the example", () => {
    expect(doc.title).toBe("Encuesta de satisfacción del servicio");
    expect(doc.desc).toBe("Ayúdenos a mejorar la atención a las familias.");
  });

  it("detects the five example questions with their types", () => {
    expect(doc.questions.map((q) => q.type)).toEqual(["date", "select", "scale", "multi", "long"]);
  });

  it("marks * questions as required and groups them in sections", () => {
    expect(doc.questions[0]?.req).toBe(true);
    expect(doc.questions[1]?.req).toBe(true);
    expect(doc.questions[2]?.req).toBe(false);
    expect(doc.questions[0]?.sec).toBe("Datos del hogar");
    expect(doc.questions[3]?.sec).toBe("Servicios");
  });

  it("keeps options listed under a question", () => {
    expect(doc.questions[3]?.opts).toEqual(["Agua", "Energía", "Salud"]);
  });

  it("builds grid questions from Filas/Columnas lines", () => {
    const g = parse("T\n1. Servicios (matriz)\nFilas: Agua | Luz\nColumnas: Sí | No");
    expect(g.questions[0]?.type).toBe("grid");
    expect(g.questions[0]?.rows).toEqual(["Agua", "Luz"]);
    expect(g.questions[0]?.cols).toEqual(["Sí", "No"]);
  });

  it("fills the four origin municipalities when none are given", () => {
    const m = parse("T\n1. Municipio de origen");
    expect(m.questions[0]?.opts).toEqual(["Paratebueno", "Medina", "Cabuyaro", "Barranca de Upía"]);
  });
});

describe("AI request", () => {
  it("truncates attached documents to 30,000 characters", () => {
    const p = iaPedido("", "x".repeat(40000));
    expect(p).toContain("x".repeat(30000));
    expect(p).not.toContain("x".repeat(30001));
  });

  it("rejects empty prompts and prompts over 60,000 characters", () => {
    expect(() => validatePrompt({ prompt: "   " })).toThrow();
    expect(() => validatePrompt({ prompt: "a".repeat(MAX_PROMPT_CHARS + 1) })).toThrow();
    expect(validatePrompt({ prompt: " hola " })).toEqual({ prompt: "hola" });
  });
});

describe("opening a downloaded .json", () => {
  it("accepts the original download format", () => {
    const d = surveyFromJson({ title: "A", desc: "B", questions: [{ id: "q1", type: "single", text: "¿Sí?", req: true, opts: ["Sí", "No"] }], responses: [] });
    expect(d.title).toBe("A");
    expect(d.questions[0]?.opts).toEqual(["Sí", "No"]);
  });

  it("rejects files without questions", () => {
    expect(() => surveyFromJson({ title: "A" })).toThrow();
  });

  it("slugifies titles for file names", () => {
    expect(slugify("Encuesta de Satisfacción!")).toBe("encuesta_de_satisfaccion");
  });
});
