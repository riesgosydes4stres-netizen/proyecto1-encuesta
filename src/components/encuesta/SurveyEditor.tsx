import { TIPOS, type Dimension, type Question, type QuestionType, type SurveyDoc } from "@/lib/survey-parser";
import { DIMENSIONS, RISK_OPTIONS, canScore, optionRisk } from "@/lib/vulnerability";

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

interface Props {
  doc: SurveyDoc;
  onChange: (doc: SurveyDoc) => void;
}

export function SurveyEditor({ doc, onChange }: Props) {
  const setQ = (i: number, patch: Partial<Question>) =>
    onChange({ ...doc, questions: doc.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  const setKey = (i: number, on: boolean) =>
    onChange({ ...doc, questions: doc.questions.map((q, j) => ({ ...q, key: j === i ? on : false })) });

  const setRisk = (i: number, opt: number, v: number) => {
    const q = doc.questions[i];
    if (!q) return;
    setQ(i, { risk: q.opts.map((_, k) => (k === opt ? v : optionRisk(q, k))) });
  };

  const setType = (i: number, type: QuestionType) => {
    const q = doc.questions[i];
    if (!q) return;
    const next: Question = { ...q, type };
    if (type === "single" || type === "multi" || type === "select") {
      if (!next.opts.length) next.opts = ["Opción 1", "Opción 2"];
    } else {
      next.opts = [];
      if (type === "grid") {
        if (!next.rows?.length) next.rows = ["Fila 1", "Fila 2"];
        if (!next.cols?.length) next.cols = ["Sí", "No"];
      }
    }
    setQ(i, next);
  };

  return (
    <>
      <div className="pt">
        <input
          type="text"
          value={doc.title}
          onChange={(e) => onChange({ ...doc, title: e.target.value })}
          aria-label="Título de la encuesta"
          placeholder="Título de tu encuesta"
        />
        <textarea
          value={doc.desc}
          onChange={(e) => onChange({ ...doc, desc: e.target.value })}
          aria-label="Descripción"
          placeholder="Descripción (opcional)"
        />
      </div>
      {doc.questions.map((q, i) => (
        <div className="qc" key={q.id}>
          <div className="r1">
            <input
              type="text"
              value={q.text}
              onChange={(e) => setQ(i, { text: e.target.value })}
              aria-label={`Pregunta ${i + 1}`}
              placeholder="Escriba la pregunta"
              data-q="text"
            />
            <select value={q.type} onChange={(e) => setType(i, e.target.value as QuestionType)} aria-label="Tipo de pregunta">
              {Object.entries(TIPOS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={q.sec ?? ""}
            onChange={(e) => setQ(i, { sec: e.target.value })}
            placeholder="Sección (opcional)"
            aria-label={`Sección de la pregunta ${i + 1}`}
          />
          {q.type === "single" || q.type === "multi" || q.type === "select" ? (
            <>
              <textarea
                key={q.type}
                defaultValue={q.opts.join("\n")}
                onChange={(e) => setQ(i, { opts: lines(e.target.value), auto: false })}
                aria-label="Opciones, una por línea"
              />
              <small>Una opción por línea.</small>
            </>
          ) : q.type === "scale" ? (
            <small>Las personas elegirán un valor del 1 al 5.</small>
          ) : q.type === "date" ? (
            <small>Las personas elegirán una fecha.</small>
          ) : q.type === "number" ? (
            <small>Solo se aceptan números.</small>
          ) : q.type === "photo" ? (
            <small>Se toma una foto con la cámara del celular o se elige de la galería.</small>
          ) : q.type === "signature" ? (
            <small>La persona encuestada firma con el dedo o el mouse.</small>
          ) : q.type === "grid" ? (
            <>
              <small>Filas (una por línea)</small>
              <textarea defaultValue={(q.rows ?? []).join("\n")} onChange={(e) => setQ(i, { rows: lines(e.target.value) })} aria-label="Filas" />
              <small>Columnas (una por línea)</small>
              <textarea defaultValue={(q.cols ?? []).join("\n")} onChange={(e) => setQ(i, { cols: lines(e.target.value) })} aria-label="Columnas" />
            </>
          ) : null}
          {canScore(q) && (
            <div className="ix">
              <label className="ix-dim">
                <span>Índice de vulnerabilidad</span>
                <select
                  value={q.dim ?? ""}
                  onChange={(e) => setQ(i, { dim: (e.target.value || undefined) as Dimension | undefined })}
                  aria-label={`Componente del índice de la pregunta ${i + 1}`}
                >
                  <option value="">No cuenta para el índice</option>
                  {DIMENSIONS.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </label>
              {q.dim && q.type !== "scale" && q.opts.length > 0 && (
                <div className="ix-opts">
                  <small>Nivel de riesgo de cada opción</small>
                  {q.opts.map((o, j) => (
                    <label key={j}>
                      <span>{o}</span>
                      <select value={optionRisk(q, j)} onChange={(e) => setRisk(i, j, Number(e.target.value))} aria-label={`Riesgo de «${o}»`}>
                        {RISK_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {q.dim && q.type === "scale" && (
                <label className="ix-chk">
                  <input type="checkbox" checked={!!q.invert} onChange={(e) => setQ(i, { invert: e.target.checked })} />
                  5 significa más vulnerable (si no lo marca, 1 es el más vulnerable)
                </label>
              )}
            </div>
          )}
          {(q.type === "short" || q.type === "number") && (
            <label className="ix-chk ix-key">
              <input type="checkbox" checked={!!q.key} onChange={(e) => setKey(i, e.target.checked)} />
              Es el código del hogar (sirve para comparar con mediciones anteriores)
            </label>
          )}
          <div className="r2">
            <label>
              <input type="checkbox" checked={q.req} onChange={(e) => setQ(i, { req: e.target.checked })} /> Obligatoria
            </label>
            <button
              className="x"
              type="button"
              onClick={() => onChange({ ...doc, questions: doc.questions.filter((_, j) => j !== i) })}
            >
              Quitar pregunta
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
