import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Question, SurveyDoc } from "@/lib/survey-parser";
import type { Answer, Answers } from "@/lib/vulnerability";
import { splitMedia } from "@/lib/vulnerability";
import { PhotoInput, SignaturePad } from "./MediaInputs";
import { ResultsView } from "./ResultsView";

/** Splits a trailing "(ayuda)" from the question text, like the original ay(). */
function splitHelp(t: string): [string, string] {
  const m = t.match(/\s*\(([^()]{3,})\)\s*$/);
  return m ? [t.replace(m[0], "").trim(), m[1] ?? ""] : [t, ""];
}

export function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  if (q.type === "grid") {
    const rows = q.rows ?? [];
    const g = a as Record<number, string>;
    return rows.length > 0 && rows.every((_, j) => !!g[j]);
  }
  if (Array.isArray(a)) return a.length > 0;
  return typeof a === "string" && a.trim() !== "";
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

interface Props {
  doc: SurveyDoc;
  logoStyle?: React.CSSProperties;
  /** Live mode: saves the answers. Without it the form is a preview that saves nothing. */
  onSubmit?: (answers: Answers) => Promise<void>;
}

export function SurveyForm({ doc, logoStyle, onSubmit }: Props) {
  const live = !!onSubmit;
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ at: string } | null>(null);
  const [sending, setSending] = useState(false);

  const visible = useMemo(() => doc.questions.filter((q) => q.text.trim()), [doc.questions]);
  const required = visible.filter((q) => q.req);
  const okCount = required.filter((q) => isAnswered(q, answers[q.id])).length;

  const groups = useMemo(() => {
    const gs: { sec: string; qs: Question[] }[] = [];
    let g: { sec: string; qs: Question[] } | null = null;
    for (const q of visible) {
      if (!g || (q.sec && q.sec !== g.sec)) {
        g = { sec: q.sec || "", qs: [] };
        gs.push(g);
      }
      g.qs.push(q);
    }
    return gs;
  }, [visible]);

  const setA = (id: string, a: Answer) => {
    setAnswers((p) => ({ ...p, [id]: a }));
    setBad((p) => {
      if (!p.has(id)) return p;
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const missing = required.filter((q) => !isAnswered(q, answers[q.id])).map((q) => q.id);
    setBad(new Set(missing));
    if (missing.length) {
      document.getElementById("eq-" + missing[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Faltan preguntas obligatorias.");
      return;
    }
    if (onSubmit) {
      setSending(true);
      try {
        await onSubmit(answers);
      } catch (err) {
        toast(err instanceof Error ? err.message : "No se pudieron enviar las respuestas.");
      } finally {
        setSending(false);
      }
      return;
    }
    setDone({ at: new Date().toISOString() });
  };

  if (done && !live) {
    const { answers: plain, media } = splitMedia(visible, answers);
    return (
      <div className="sv">
        <div className="sv-ok">
          <h3>¡Gracias por responder!</h3>
          <p>Vista previa: así se verán los resultados y el informe. Aquí no se guarda nada.</p>
        </div>
        <ResultsView
          data={{ title: doc.title, desc: doc.desc, questions: visible, answers: plain, media, createdAt: done.at, preview: true }}
          actions={
            <button className="btn line" type="button" onClick={() => { setAnswers({}); setDone(null); }}>
              Volver a la encuesta
            </button>
          }
        />
      </div>
    );
  }

  let n = 0;
  return (
    <div className="sv">
      <div className="sv-h">
        <span className="mark" role="img" aria-label="Logo UNGRD" style={logoStyle} />
        <div>
          <small>UNGRD · Seguimiento a comunidades reasentadas</small>
          <h2 className="et">{doc.title}</h2>
          {doc.desc && <p className="ed">{doc.desc}</p>}
        </div>
      </div>
      {required.length > 0 && (
        <div className="sv-pr">
          <div className="pb">
            <i style={{ width: `${(okCount / required.length) * 100}%` }} />
          </div>
          <span>
            {okCount} de {required.length} obligatorias
          </span>
        </div>
      )}
      <form noValidate onSubmit={(e) => void handleSubmit(e)} onReset={() => { setAnswers({}); setBad(new Set()); }}>
        {groups.map((g, gi) => (
          <div className="sv-s" key={gi}>
            {g.sec && <h3 className="es">{g.sec}</h3>}
            {g.qs.map((q) => {
              n++;
              const id = "f" + q.id;
              const [tx, h0] = splitHelp(q.text);
              const numDoc = /c[eé]dula|n[uú]mero de documento|documento de identidad/i.test(q.text);
              const hp =
                h0 ||
                (q.type === "multi"
                  ? "Marque todas las que apliquen."
                  : q.type === "single"
                    ? "Seleccione una opción."
                    : q.type === "grid"
                      ? "Marque una opción en cada fila."
                      : q.type === "photo"
                        ? "Tome la foto con autorización de la persona. Solo la verá el equipo responsable."
                        : q.type === "signature"
                          ? "La persona encuestada firma en el recuadro."
                      : q.type === "scale"
                        ? "1 = más bajo · 5 = más alto"
                        : "");
              const a = answers[q.id];
              const str = typeof a === "string" ? a : "";
              let c: React.ReactNode;
              if (q.type === "photo")
                c = <PhotoInput id={id} value={str} onChange={(v) => setA(q.id, v)} />;
              else if (q.type === "signature")
                c = <SignaturePad key={id + (str ? "-s" : "-e")} id={id} value={str} onChange={(v) => setA(q.id, v)} />;
              else if (q.type === "long")
                c = <textarea className="etx" id={id} value={str} onChange={(e) => setA(q.id, e.target.value)} placeholder="Escriba su respuesta" aria-labelledby={"l" + id} />;
              else if (q.type === "grid") {
                const g2 = (a as Record<number, string> | undefined) ?? {};
                c = (
                  <div className="gw">
                    <table className="gt">
                      <thead>
                        <tr>
                          <th />
                          {(q.cols ?? []).map((x) => <th key={x}>{x}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {(q.rows ?? []).map((r, j) => (
                          <tr key={j}>
                            <td className="rl">{r}</td>
                            {(q.cols ?? []).map((x) => (
                              <td key={x}>
                                <input type="radio" name={`${id}_${j}`} checked={g2[j] === x} onChange={() => setA(q.id, { ...g2, [j]: x })} aria-label={`${r}: ${x}`} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              } else if (q.type === "number")
                c = <input className="ei nm" type="number" id={id} min={0} step={1} inputMode="numeric" value={str} onChange={(e) => setA(q.id, e.target.value)} placeholder="Escriba un número" aria-labelledby={"l" + id} />;
              else if (q.type === "date")
                c = (
                  <div className="dtw">
                    <CalendarIcon />
                    <input
                      className={"ei dt" + (str ? " has" : "")}
                      type="date"
                      id={id}
                      value={str}
                      onChange={(e) => setA(q.id, e.target.value)}
                      onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } }}
                      aria-labelledby={"l" + id}
                    />
                  </div>
                );
              else if (q.type === "scale")
                c = (
                  <div className="esc" role="radiogroup" aria-labelledby={"l" + id}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <label className="eo" key={v}>
                        <input type="radio" name={id} value={v} checked={str === String(v)} onChange={() => setA(q.id, String(v))} />
                        {v}
                      </label>
                    ))}
                  </div>
                );
              else if (q.type === "select")
                c = (
                  <select className="ei" id={id} value={str} onChange={(e) => setA(q.id, e.target.value)} aria-labelledby={"l" + id}>
                    <option value="" disabled>Seleccione una opción</option>
                    {q.opts.map((o) => <option key={o}>{o}</option>)}
                  </select>
                );
              else if (q.type === "single")
                c = (
                  <div role="radiogroup" aria-labelledby={"l" + id}>
                    {q.opts.map((o) => (
                      <label className="eo" key={o}>
                        <input type="radio" name={id} checked={str === o} onChange={() => setA(q.id, o)} />
                        {o}
                      </label>
                    ))}
                  </div>
                );
              else if (q.type === "multi") {
                const arr = Array.isArray(a) ? a : [];
                c = (
                  <div role="group" aria-labelledby={"l" + id}>
                    {q.opts.map((o) => (
                      <label className="eo" key={o}>
                        <input
                          type="checkbox"
                          name={id}
                          checked={arr.includes(o)}
                          onChange={(e) => setA(q.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                );
              } else
                c = (
                  <input
                    className="ei"
                    type="text"
                    id={id}
                    autoComplete="off"
                    value={str}
                    onChange={(e) => setA(q.id, e.target.value)}
                    placeholder={numDoc ? "Solo números" : "Escriba su respuesta"}
                    inputMode={numDoc ? "numeric" : undefined}
                    aria-labelledby={"l" + id}
                  />
                );
              return (
                <div className={"eq" + (bad.has(q.id) ? " bad" : "")} id={"eq-" + q.id} key={q.id}>
                  <div className="el" id={"l" + id}>
                    {q.req && <span className="rq" aria-hidden="true">*</span>}
                    <b>{n}.</b> {tx}
                  </div>
                  {hp && <div className="eh">{hp}</div>}
                  {c}
                  {bad.has(q.id) && <div className="ee">Esta pregunta es obligatoria.</div>}
                </div>
              );
            })}
          </div>
        ))}
        <div className="sv-a">
          <button className="btn navy" type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar respuestas"}</button>
          <button className="btn line" type="reset">Borrar respuestas</button>
        </div>
      </form>
      <p className="sv-f">
        {required.length ? "* Indica que la pregunta es obligatoria. " : ""}
        {live ? "Sus respuestas se envían de forma segura al equipo responsable de la encuesta." : "Vista previa: aquí las respuestas no se guardan."}
      </p>
    </div>
  );
}
