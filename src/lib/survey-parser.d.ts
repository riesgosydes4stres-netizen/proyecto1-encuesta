export type QuestionType =
  | "short"
  | "date"
  | "number"
  | "grid"
  | "select"
  | "long"
  | "single"
  | "multi"
  | "scale"
  | "photo"
  | "signature";

/** Component of the Índice de Vulnerabilidad Territorial a question feeds. */
export type Dimension = "vivienda" | "medios" | "sst";

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
  /** Index component this question contributes to (none when absent). */
  dim?: Dimension | undefined;
  /** Vulnerability per option (0 = bajo, 50 = medio, 100 = alto), aligned with opts. */
  risk?: number[];
  /** Scale questions: true when 5 means more vulnerable (default: 1 means more vulnerable). */
  invert?: boolean;
  /** Marks the household code question used to match previous responses. */
  key?: boolean;
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
