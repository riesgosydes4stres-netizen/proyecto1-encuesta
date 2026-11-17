import { describe, expect, it, vi } from "vitest";
import { AI_DOCUMENT_PART_CHARS, aiDocumentPrompt, draftWithAi, splitAiDocument } from "@/lib/ai-survey";
import { MAX_PROMPT_CHARS } from "@/lib/ai.functions";

describe("full-document AI drafting", () => {
  it("processes all text beyond both old limits without loss", () => {
    const document = Array.from({ length: 200 }, (_, i) => `${i + 1}. Pregunta ${i}: ${"contenido ".repeat(50)}\n- Sí\n- No\n`).join("") + "FIN DEL ARCHIVO";
    expect(document.length).toBeGreaterThan(60_000);
    const parts = splitAiDocument(document);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(document);
    for (const [i, part] of parts.entries()) {
      expect(part.length).toBeLessThanOrEqual(AI_DOCUMENT_PART_CHARS);
      expect(aiDocumentPrompt("", part, i, parts.length).length).toBeLessThan(MAX_PROMPT_CHARS);
    }
  });

  it("keeps all characters even without newlines", () => {
    const text = "a".repeat(70000) + "😀";
    expect(splitAiDocument(text).join("")).toBe(text);
  });

  it("merges every part in order without limiting the questions", async () => {
    const generate = vi.fn(async (_prompt: string) => ({ text: `Encuesta\nDescripción: Completa\n1. Pregunta del bloque ${generate.mock.calls.length}?\n- Sí\n- No` }));
    const progress = vi.fn();
    const document = "x".repeat(70000);
    const result = await draftWithAi("", document, generate, progress);
    expect(result.doc.questions).toHaveLength(splitAiDocument(document).length);
    expect(result.doc.questions.at(-1)?.text).toBe("Pregunta del bloque 6?");
    expect(progress).toHaveBeenLastCalledWith(6, 6);
    expect(generate.mock.calls.map(([prompt]) => prompt).join("\n")).toContain("x".repeat(10000));
  });

  it("does not deliver an incomplete survey when a part fails", async () => {
    const generate = vi.fn().mockResolvedValueOnce({ text: "Encuesta\n1. Primera pregunta?" }).mockResolvedValueOnce({ error: "Parte incompleta" });
    await expect(draftWithAi("", "x".repeat(24001), generate, vi.fn())).rejects.toThrow("Parte incompleta");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});