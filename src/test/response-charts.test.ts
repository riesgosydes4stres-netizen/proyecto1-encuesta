import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/survey-parser";
import { buildAnswerCharts } from "@/lib/response-charts";

const q = (p: Partial<Question>): Question => ({ id: "old", text: "Pregunta guardada", type: "single", opts: ["Sí", "No"], req: false, ...p });

describe("Gráficas de encuestas ya creadas", () => {
  it("charts existing answers without index configuration or modifying questions", () => {
    const questions = [q({})];
    const original = structuredClone(questions);
    const chart = buildAnswerCharts(questions, [{ old: "Sí" }, { old: "No" }, { old: "Sí" }, {}])[0];
    expect(chart?.rows).toEqual([{ name: "Sí", count: 2 }, { name: "No", count: 1 }]);
    expect(chart?.answered).toBe(3);
    expect(chart?.total).toBe(4);
    expect(questions).toEqual(original);
  });
  it("counts each multi-choice selection once per response", () => {
    const chart = buildAnswerCharts([q({ type: "multi", opts: ["Agua", "Luz"] })], [{ old: ["Agua", "Agua", "Luz"] }, { old: ["Luz"] }])[0];
    expect(chart?.rows.map((r) => r.count)).toEqual([1, 2]);
    expect(chart?.answered).toBe(2);
  });
  it("includes scales and every matrix row", () => {
    const charts = buildAnswerCharts([q({ type: "scale" }), q({ id: "grid", type: "grid", rows: ["Techo", "Piso"], cols: ["Bueno", "Malo"] })], [{ old: "5", grid: { 0: "Bueno", 1: "Malo" } }]);
    expect(charts[0]?.rows.map((r) => r.count)).toEqual([0, 0, 0, 0, 1]);
    expect(charts[1]?.rows.map((r) => r.count)).toEqual([1, 0]);
    expect(charts[2]?.rows.map((r) => r.count)).toEqual([0, 1]);
  });
  it("shows text completion without placing personal answers in chart labels", () => {
    const chart = buildAnswerCharts([q({ type: "short", opts: [] })], [{ old: "dato privado" }, { old: "   " }, {}])[0];
    expect(chart?.rows).toEqual([{ name: "Con respuesta", count: 1 }, { name: "Sin respuesta", count: 2 }]);
  });
  it("summarizes numeric answers including zero, excluding invalid values and household codes", () => {
    const charts = buildAnswerCharts([q({ type: "number", opts: [] }), q({ id: "code", type: "number", key: true, opts: [] })], [{ old: "0", code: "123" }, { old: "2,5" }, { old: "error" }]);
    expect(charts[0]?.numeric).toEqual({ mean: 1.25, min: 0, max: 2.5 });
    expect(charts[0]?.answered).toBe(2);
    expect(charts[1]?.numeric).toBeUndefined();
  });
  it("does not fabricate charts before responses or chart photo and signature contents", () => {
    expect(buildAnswerCharts([q({})], [])).toEqual([]);
    expect(buildAnswerCharts([q({ type: "photo" }), q({ type: "signature" })], [{ old: "data:image/png;base64,AAA" }])).toEqual([]);
  });
});