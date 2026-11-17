import type { Question } from "./survey-parser";
import type { Answers } from "./vulnerability";

export interface AnswerChart {
  id: string;
  title: string;
  rows: { name: string; count: number }[];
  answered: number;
  total: number;
  numeric?: { mean: number; min: number; max: number };
}

/** Descriptive charts need neither index assignments nor changes to saved surveys. */
export function buildAnswerCharts(questions: Question[], responses: Answers[]): AnswerChart[] {
  if (!responses.length) return [];
  return questions.filter((q) => q.text.trim() && q.type !== "photo" && q.type !== "signature").flatMap((q): AnswerChart[] => {
    const values = responses.map((a) => a[q.id]);
    if (q.type === "grid") {
      return (q.rows ?? []).map((row, i) => {
        const counts = (q.cols ?? []).map((name) => ({ name, count: values.filter((a) => a && typeof a === "object" && !Array.isArray(a) && a[i] === name).length }));
        return { id: `${q.id}-${i}`, title: `${q.text} · ${row}`, rows: counts, answered: counts.reduce((sum, r) => sum + r.count, 0), total: responses.length };
      });
    }
    if (["single", "select", "multi", "scale"].includes(q.type)) {
      const opts = q.type === "scale" ? ["1", "2", "3", "4", "5"] : [...new Set(q.opts)];
      const valid = (a: typeof values[number]) => q.type === "multi"
        ? Array.isArray(a) && a.some((v) => opts.includes(v))
        : typeof a === "string" && opts.includes(a);
      return [{ id: q.id, title: q.text, total: responses.length, answered: values.filter(valid).length,
        rows: opts.map((name) => ({ name, count: values.filter((a) => q.type === "multi" ? Array.isArray(a) && a.includes(name) : a === name).length })) }];
    }
    // Free text, dates and identifiers are never grouped into public-facing labels.
    const entered = values.filter((a) => typeof a === "string" && a.trim().length > 0);
    const nums = q.type === "number" ? entered.filter((a): a is string => typeof a === "string").map((a) => Number(a.replace(",", "."))).filter(Number.isFinite) : [];
    const answered = q.type === "number" ? nums.length : entered.length;
    return [{ id: q.id, title: q.text, total: responses.length, answered,
      rows: [{ name: "Con respuesta", count: answered }, { name: "Sin respuesta", count: responses.length - answered }],
      ...(nums.length && !q.key ? { numeric: { mean: nums.reduce((s, n) => s + n, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums) } } : {}) }];
  });
}