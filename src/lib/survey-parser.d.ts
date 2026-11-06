export type QuestionType = "short" | "date" | "number" | "grid" | "select" | "long" | "single" | "multi" | "scale";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  req: boolean;
  sec?: string;
  opts: string[];
  rows?: string[];
  cols?: string[];
  /** true when the parser filled in placeholder options */
  auto?: boolean;
}

export interface SurveyDoc {
  title: string;
  desc: string;
  questions: Question[];
}

export const TIPOS: Record<QuestionType, string>;
export function uid(): string;
export function parse(text: string, fname?: string): SurveyDoc;
export function htmlATexto(html: string): string;
export const IA_REGLAS: string;
export function iaPedido(tema: string, doc: string): string;
export const EJEMPLO: string;
export function slugify(title: string): string;
