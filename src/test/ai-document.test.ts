import { describe, expect, it } from "vitest";
import { documentParts, documentPrompts, mergeAiDocuments } from "@/lib/ai-document";

describe("complete AI document conversion", () => {
  it("includes the last field of long documents without losing any question or option", () => {
    const questions = Array.from({ length: 100 }, (_, i) => `${i + 1}. ¿Campo ${i + 1}: ${"detalle ".repeat(50)}?\n- Sí\n- No`);
    const source = "Seguimiento\nSección: Vivienda\n" + questions.join("\n");
    expect(source.length).toBeGreaterThan(30000);
    const parts = documentParts(source);
    expect(parts.length).toBeGreaterThan(1);
    for (const question of questions) expect(parts.some((part) => part.includes(question))).toBe(true);
    expect(documentPrompts("", source).at(-1)).toContain(questions[99]);
    expect(parts.every((part) => part.includes("Sección: Vivienda"))).toBe(true);
  });

  it("preserves prose beyond the first chunk", () => {
    const source = "texto ".repeat(10000) + "CAMPO FINAL";
    expect(documentParts(source).join("")).toBe(source);
  });

  it("merges all parts in order without replacing the first title or description", () => {
    const doc = mergeAiDocuments([
      "Seguimiento\nDescripción: Original\nSección: Vivienda\n1. ¿Tiene agua?\n- Sí\n- No",
      "Otro título\nDescripción: Otra\nSección: SST\n1. ¿Tiene accidentes?\n- Sí\n- No",
    ]);
    expect(doc.title).toBe("Seguimiento");
    expect(doc.desc).toBe("Original");
    expect(doc.questions.map((q) => q.text)).toEqual(["¿Tiene agua?", "¿Tiene accidentes?"]);
    expect(doc.questions.map((q) => q.sec)).toEqual(["Vivienda", "SST"]);
  });

  it("rejects missing source fields instead of accepting an incomplete survey", () => {
    expect(() => mergeAiDocuments(["T\n1. ¿Tiene agua?"], "T\n1. ¿Tiene agua?\n2. Edad: ____")).toThrow("Edad");
  });

  it("rejects missing original options", () => {
    expect(() => mergeAiDocuments(["T\n1. ¿Servicios?\n- Agua"], "T\n1. ¿Servicios?\n- Agua\n- Energía")).toThrow("Servicios");
  });
});