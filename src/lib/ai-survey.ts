import { iaPedido, parse, type SurveyDoc } from "./survey-parser";

// Bound each request, not the total document. Prefer question/section boundaries
// so options and table rows stay with their question whenever possible.
export const AI_DOCUMENT_PART_CHARS = 12_000;

export function splitAiDocument(text: string): string[] {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > AI_DOCUMENT_PART_CHARS) {
    const window = remaining.slice(0, AI_DOCUMENT_PART_CHARS);
    const boundaries = [...window.matchAll(/\n(?=(?:\d+\s*[.)]|¿|Secci[oó]n\s*:))/gi)];
    const last = boundaries.at(-1)?.index;
    const newline = window.lastIndexOf("\n");
    let end = last !== undefined && last > AI_DOCUMENT_PART_CHARS / 2 ? last + 1 : newline + 1;
    if (end < AI_DOCUMENT_PART_CHARS / 2) end = AI_DOCUMENT_PART_CHARS;
    // Do not split a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1] ?? "")) end--;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

export function aiDocumentPrompt(topic: string, part: string, index: number, total: number): string {
  return iaPedido(topic, part) +
    `\nEste es el bloque ${index + 1} de ${total} del mismo documento. Conserve TODAS las preguntas, campos, opciones y filas de este bloque; no haga un resumen ni reduzca la cantidad de preguntas. Incluya título y descripción para que este bloque se pueda interpretar por separado.`;
}

export async function draftWithAi(
  topic: string,
  document: string,
  generate: (prompt: string) => Promise<{ text: string } | { error: string }>,
  progress: (part: number, total: number) => void,
): Promise<{ doc: SurveyDoc; text: string }> {
  const parts = document.trim() ? splitAiDocument(document) : [""];
  const drafts: SurveyDoc[] = [];
  const outputs: string[] = [];
  for (const [index, part] of parts.entries()) {
    progress(index + 1, parts.length);
    const prompt = document.trim() ? aiDocumentPrompt(topic, part, index, parts.length) : iaPedido(topic, "");
    const result = await generate(prompt);
    if ("error" in result) throw new Error(result.error);
    const text = result.text.replace(/```[a-z]*\n?/gi, "").trim();
    const draft = parse(text);
    if (!draft.questions.length) throw new Error(`No se encontraron preguntas en la parte ${index + 1}. Su archivo sigue adjunto; intente de nuevo.`);
    outputs.push(text);
    drafts.push(draft);
  }
  const first = drafts[0];
  if (!first) throw new Error("La IA no devolvió preguntas.");
  return {
    doc: { ...first, questions: drafts.flatMap((draft) => draft.questions) },
    text: outputs.join("\n\n"),
  };
}