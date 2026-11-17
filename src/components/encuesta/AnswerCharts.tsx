import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Question } from "@/lib/survey-parser";
import { buildAnswerCharts } from "@/lib/response-charts";
import { fmt, type Answers } from "@/lib/vulnerability";

export function AnswerCharts({ questions, responses }: { questions: Question[]; responses: Answers[] }) {
  const charts = useMemo(() => buildAnswerCharts(questions, responses), [questions, responses]);
  if (!charts.length) return null;
  return (
    <section className="answer-charts" aria-label="Gráficas de respuestas">
      <h3>Gráficas de respuestas</h3>
      <div className="res-grid">
        {charts.map((chart) => (
          <article className="res-card" key={chart.id}>
            <h4>{chart.title}</h4>
            <p className="res-sub">{chart.answered} de {chart.total} {chart.total === 1 ? "respuesta registrada" : "respuestas registradas"}</p>
            {chart.numeric && <p className="res-sub">Promedio: <b>{fmt(chart.numeric.mean)}</b> · Mínimo: {fmt(chart.numeric.min)} · Máximo: {fmt(chart.numeric.max)}</p>}
            <div className="answer-chart" role="img" aria-label={chart.rows.map((r) => `${r.name}: ${r.count}`).join("; ")}>
              <ResponsiveContainer width="100%" height={Math.max(120, chart.rows.length * 44 + 30)}>
                <BarChart data={chart.rows} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis type="number" allowDecimals={false} domain={[0, Math.max(1, ...chart.rows.map((r) => r.count))]} tickLine={false} axisLine={false} tick={{ fill: "var(--mute)", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={115} tickFormatter={(v: string) => v.length > 17 ? v.slice(0, 16) + "…" : v} tickLine={false} axisLine={false} tick={{ fill: "var(--ink)", fontSize: 12 }} />
                  <Tooltip position={{ x: 0, y: 0 }} wrapperStyle={{ maxWidth: "100%" }} contentStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }} cursor={{ fill: "var(--paper)" }} />
                  <Bar dataKey="count" name="Respuestas" fill="var(--blue)" maxBarSize={24} radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="count" position="right" style={{ fill: "var(--ink)", fontWeight: 700, fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="answer-chart-values">
              <summary>Ver valores completos</summary>
              <dl>{chart.rows.map((r) => <div key={r.name}><dt>{r.name}</dt><dd>{r.count}</dd></div>)}</dl>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}