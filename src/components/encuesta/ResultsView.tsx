import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import type { Question } from "@/lib/survey-parser";
import {
  DIMENSIONS,
  LEVELS,
  answerText,
  compareIndex,
  computeIndex,
  dimLabel,
  fmt,
  hasIndexConfig,
  levelOf,
  questionRisk,
  type Answers,
} from "@/lib/vulnerability";
import { deliverFile, makeReportBlob } from "@/lib/pdf-download";
import { reportFileName } from "@/lib/report-pdf";

export interface ResultsData {
  title: string;
  desc?: string;
  questions: Question[];
  answers: Answers;
  media: Record<string, string>;
  createdAt: string;
  responseId?: string;
  householdCode?: string;
  previous?: { createdAt: string; questions: Question[]; answers: Answers; surveyTitle?: string } | null;
  preview?: boolean;
}

export function Gauge({ value, size = 240 }: { value: number | null; size?: number }) {
  const r = 90;
  const pt = (v: number, rad = r) => {
    const a = Math.PI - (v / 100) * Math.PI;
    return [110 + rad * Math.cos(a), 110 - rad * Math.sin(a)] as const;
  };
  const segs = [
    [0, 25],
    [25, 50],
    [50, 75],
    [75, 100],
  ] as const;
  const needle = value === null ? null : pt(Math.min(100, Math.max(0, value)), r - 18);
  return (
    <svg viewBox="0 0 220 130" width={size} height={(size * 130) / 220} className="gauge" role="img" aria-label={value === null ? "Sin índice" : `Índice ${fmt(value)} de 100`}>
      {segs.map(([a, b], i) => {
        const [x1, y1] = pt(a + 0.8);
        const [x2, y2] = pt(b - 0.8);
        return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={LEVELS[i]!.hex} strokeWidth={18} fill="none" opacity={value === null ? 0.3 : 1} />;
      })}
      {needle && (
        <>
          <line x1={110} y1={110} x2={needle[0]} y2={needle[1]} className="gauge-needle" strokeWidth={4} strokeLinecap="round" />
          <circle cx={110} cy={110} r={7} className="gauge-hub" />
        </>
      )}
    </svg>
  );
}

export function LevelChip({ score }: { score: number | null }) {
  if (score === null) return <span className="lvl lvl-none">Sin datos</span>;
  const l = levelOf(score);
  return <span className={"lvl lvl-" + l.key}>{l.label}</span>;
}

export function ResultsView({ data, actions, emailSlot }: { data: ResultsData; actions?: ReactNode; emailSlot?: ReactNode }) {
  const visible = useMemo(() => data.questions.filter((q) => q.text.trim()), [data.questions]);
  const idx = useMemo(() => computeIndex(visible, data.answers), [visible, data.answers]);
  const prevIdx = useMemo(() => (data.previous ? computeIndex(data.previous.questions, data.previous.answers) : null), [data.previous]);
  const deltas = prevIdx ? compareIndex(prevIdx, idx) : null;
  const configured = hasIndexConfig(visible);

  const [pdf, setPdf] = useState<Blob | null>(null);
  const [pdfErr, setPdfErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setPdf(null);
    setPdfErr(false);
    makeReportBlob({ ...data, questions: visible })
      .then((b) => alive && setPdf(b))
      .catch((e) => {
        console.error(e);
        if (alive) setPdfErr(true);
      });
    return () => {
      alive = false;
    };
  }, [data, visible]);

  const chartData = DIMENSIONS.map((d) => ({ name: d.label, valor: idx.dims[d.key] ?? 0, has: idx.dims[d.key] !== null }));
  const cmpData = deltas?.map((r) => ({ name: r.label, Anterior: r.prev ?? 0, Actual: r.cur ?? 0, cur: r.cur }));
  const fileName = reportFileName(data.title, data.householdCode);

  const byDim = DIMENSIONS.map((d) => ({
    ...d,
    rows: visible
      .filter((q) => q.dim === d.key)
      .map((q) => ({ q, a: data.answers[q.id], risk: questionRisk(q, data.answers[q.id]) })),
  })).filter((g) => g.rows.length);

  return (
    <div className="res">
      <div className="res-hero">
        <div className="res-gauge">
          <Gauge value={idx.ivt} />
          <b className="res-num">{idx.ivt === null ? "—" : fmt(idx.ivt)}</b>
          <LevelChip score={idx.ivt} />
        </div>
        <div className="res-copy">
          <p className="lbl">Levantamiento de variables · Indicadores de vulnerabilidad</p>
          <h3>Índice de Vulnerabilidad Territorial</h3>
          <p>
            {configured
              ? "IVT = (Vivienda + Medios de vida + SST) / 3. Cada componente pesa un tercio; 0 es sin vulnerabilidad y 100 es vulnerabilidad máxima."
              : "Esta encuesta todavía no tiene preguntas asignadas a Vivienda, Medios de vida o SST. Asígnelas en «Editar preguntas» para calcular el índice."}
          </p>
          {configured && !idx.complete && idx.ivt !== null && <p className="res-note">Algún componente no tiene respuestas; el IVT promedia solo los disponibles.</p>}
          {data.householdCode && <p className="res-meta">Hogar <b>{data.householdCode.toUpperCase()}</b></p>}
        </div>
      </div>

      <div className="res-grid">
        <div className="res-card">
          <h4>Componentes del índice</h4>
          <div className="res-chart" aria-label="Gráfica de componentes">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={chartData} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--ink)", fontSize: 13 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--mute)", fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "var(--paper)" }} />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.has ? levelOf(d.valor).hex : "var(--line)"} />
                  ))}
                  <LabelList dataKey="valor" position="top" formatter={(v: number) => fmt(v)} style={{ fill: "var(--ink)", fontWeight: 700, fontSize: 13 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="res-dims">
            {DIMENSIONS.map((d) => (
              <li key={d.key}>
                <span>{d.label}<small>{idx.counts[d.key]} {idx.counts[d.key] === 1 ? "pregunta" : "preguntas"}</small></span>
                <b>{fmt(idx.dims[d.key])}</b>
                <LevelChip score={idx.dims[d.key]} />
              </li>
            ))}
          </ul>
        </div>

        <div className="res-card">
          <h4>Cruce con la medición anterior</h4>
          {deltas && cmpData ? (
            <>
              <p className="res-sub">
                Registro del {new Date(data.previous!.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                {data.previous!.surveyTitle ? ` · ${data.previous!.surveyTitle}` : ""}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cmpData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--ink)", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--mute)", fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "var(--paper)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Anterior" fill="var(--grey-bar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Actual" fill="var(--blue)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {cmpData.map((d, i) => (
                      <Cell key={i} fill={d.cur === null ? "var(--line)" : levelOf(d.cur).hex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <table className="delta">
                <thead><tr><th>Componente</th><th>Antes</th><th>Ahora</th><th>Cambio</th></tr></thead>
                <tbody>
                  {deltas.map((r) => (
                    <tr key={r.key} className={r.key === "ivt" ? "tot" : ""}>
                      <td>{r.label}</td>
                      <td>{fmt(r.prev)}</td>
                      <td>{fmt(r.cur)}</td>
                      <td className={r.diff === null || r.diff === 0 ? "" : r.diff > 0 ? "up" : "down"}>
                        {r.diff === null ? "—" : (r.diff > 0 ? "▲ +" : r.diff < 0 ? "▼ " : "") + fmt(r.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="res-sub">
              {data.preview
                ? "En la vista previa no hay mediciones anteriores para comparar."
                : data.householdCode
                  ? "No hay una medición anterior de este hogar (o solo la puede ver el equipo responsable de la encuesta)."
                  : "Para comparar con mediciones anteriores, marque en el creador la pregunta que contiene el código del hogar."}
            </p>
          )}
        </div>
      </div>

      {byDim.length > 0 && (
        <div className="res-card">
          <h4>Variables que componen el índice</h4>
          <div className="res-vars">
            {byDim.map((g) => (
              <div key={g.key}>
                <h5>{dimLabel(g.key)}</h5>
                <ul>
                  {g.rows.map(({ q, a, risk }) => (
                    <li key={q.id}>
                      <span className="vq">{q.text}</span>
                      <span className="va">{answerText(q, a)}</span>
                      <span className="vr">
                        <i style={{ width: `${risk ?? 0}%`, background: risk === null ? "var(--line)" : levelOf(risk).hex }} />
                      </span>
                      <b>{risk === null ? "—" : fmt(risk, 0)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="res-actions">
        <button
          className="btn gold"
          type="button"
          disabled={!pdf}
          onClick={() => {
            if (pdf) void deliverFile(pdf, fileName);
          }}
        >
          {pdf ? "Descargar informe PDF" : pdfErr ? "No se pudo generar el PDF" : "Preparando el PDF…"}
        </button>
        {pdfErr && (
          <button className="btn line" type="button" onClick={() => toast("Recargue la página e intente de nuevo.")}>¿Qué hago?</button>
        )}
        {actions}
      </div>
      {emailSlot}
    </div>
  );
}
