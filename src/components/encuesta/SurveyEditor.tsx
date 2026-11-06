import { TIPOS, type Question, type QuestionType, type SurveyDoc } from "@/lib/survey-parser";

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

interface Props {
  doc: SurveyDoc;
  onChange: (doc: SurveyDoc) => void;
}

export function SurveyEditor({ doc, onChange }: Props) {
  const setQ = (i: number, patch: Partial<Question>) =>
    onChange({ ...doc, questions: doc.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

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
          ) : q.type === "grid" ? (
            <>
              <small>Filas (una por línea)</small>
              <textarea defaultValue={(q.rows ?? []).join("\n")} onChange={(e) => setQ(i, { rows: lines(e.target.value) })} aria-label="Filas" />
              <small>Columnas (una por línea)</small>
              <textarea defaultValue={(q.cols ?? []).join("\n")} onChange={(e) => setQ(i, { cols: lines(e.target.value) })} aria-label="Columnas" />
            </>
          ) : null}
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
