import { iaPedido, parse, type SurveyDoc } from "./survey-parser";

const CHUNK_CHARS = 6_000;
const CHUNK_QUESTIONS = 15;
const boundary = /^(?:(?:pregunta\s+)?\d+\s*[.)\-:]\s+|¿|Sección\s*:)/i;

/** Keep question/option groups together and carry the section across requests. */
export function documentParts(source: string): string[] {
  const blocks: string[] = [];
  for (const line of source.replace(/\r/g, "").split("\n")) {
    if (!blocks.length || boundary.test(line.trim())) blocks.push(line);
    else blocks[blocks.length - 1] += "\n" + line;
  }
  const parts: string[] = [];
  let current = "", section = "", count = 0;
  for (const block of blocks) {
    // A prose document may have no question boundaries; split it at paragraph/word boundaries.
    const segments = block.length > CHUNK_CHARS
      ? block.match(/[\s\S]{1,6000}(?:\s|$)|\S{1,6000}/g) ?? [block]
      : [block];
    for (const segment of segments) {
      if (current && (current.length + segment.length > CHUNK_CHARS || count >= CHUNK_QUESTIONS)) {
        parts.push(current);
        current = section ? section + "\n" : "";
        count = 0;
      }
      current += (current ? "\n" : "") + segment;
      count += /^(?:pregunta\s+)?\d+\s*[.)\-:]\s+|^¿/i.test(segment.trim()) ? 1 : 0;
      const headings = [...segment.matchAll(/^Sección\s*:\s*.+$/gim)];
      section = headings.at(-1)?.[0] ?? section;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function documentPrompts(instructions: string, source: string): string[] {
  const parts = documentParts(source);
  return parts.map((part, index) => iaPedido(
    instructions + `\nEstá procesando la parte ${index + 1} de ${parts.length}. Convierta todo su contenido, sin resumir ni omitir campos. No repita preguntas de otras partes.`,
    part,
  ));
}

const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function mergeAiDocuments(outputs: string[], source = ""): SurveyDoc {
  const docs = outputs.map((out) => parse(out.replace(/```[a-z]*\n?/gi, "").trim()));
  const first = docs[0];
  if (!first || docs.some((doc) => !doc.questions.length))
    throw new Error("La IA dejó una parte del documento sin preguntas. No se creó una encuesta incompleta.");
  const result = { ...first, questions: docs.flatMap((doc) => doc.questions) };
  // Known form fields must survive conversion, including every original option/matrix entry.
  const original = source ? parse(source) : null;
  for (const field of original?.questions ?? []) {
    const matches = result.questions.filter((q) => normalized(q.text) === normalized(field.text));
    const preserved = matches.some((q) =>
      (field.auto || field.opts.every((opt) => q.opts.some((o) => normalized(o) === normalized(opt)))) &&
      (field.rows ?? []).every((row) => q.rows?.some((r) => normalized(r) === normalized(row))) &&
      (field.cols ?? []).every((col) => q.cols?.some((c) => normalized(c) === normalized(col))),
    );
    if (!preserved)
      throw new Error(`La IA no conservó todo el campo «${field.text}». No se creó una encuesta incompleta; puede cargarlo en «Usar un documento» para conservar el original.`);
  }
  return result;
}