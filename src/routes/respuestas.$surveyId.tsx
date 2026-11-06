import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getOwnSurvey } from "@/lib/surveys";
import { deleteResponse, findPrevious, getResponseMedia, listResponses, type StoredResponse } from "@/lib/responses";
import { DIMENSIONS, LEVELS, computeIndex, fmt, levelOf } from "@/lib/vulnerability";
import type { Question } from "@/lib/survey-parser";
import { PageShell } from "@/components/encuesta/PageShell";
import { LevelChip, ResultsView } from "@/components/encuesta/ResultsView";

export const Route = createFileRoute("/respuestas/$surveyId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Respuestas e indicadores de vulnerabilidad · UNGRD" },
      { name: "description", content: "Resultados de la encuesta: Índice de Vulnerabilidad Territorial por hogar, gráficas y comparación con mediciones anteriores." },
      { property: "og:title", content: "Respuestas e indicadores de vulnerabilidad · UNGRD" },
      { property: "og:description", content: "Índice de Vulnerabilidad Territorial (Vivienda + Medios de vida + SST) por hogar, con gráficas e informes PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResponsesPage,
});

function ResponsesPage() {
  const { surveyId } = Route.useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const survey = useQuery({ queryKey: ["own-survey", surveyId, user?.id], queryFn: () => getOwnSurvey(user!.id, surveyId), enabled: !!user });
  const responses = useQuery({ queryKey: ["responses", surveyId], queryFn: () => listResponses(surveyId), enabled: !!user && !!survey.data });

  const del = useMutation({
    mutationFn: deleteResponse,
    onSuccess: () => {
      setOpenId(null);
      void qc.invalidateQueries({ queryKey: ["responses", surveyId] });
      toast("Respuesta eliminada.");
    },
    onError: (e: Error) => toast(e.message),
  });

  const questions = survey.data?.questions ?? [];
  const rows = useMemo(
    () => (responses.data ?? []).map((r) => ({ r, idx: computeIndex(questions, r.answers) })),
    [responses.data, questions],
  );

  if (!ready) return <PageShell><div className="ld"><b>Cargando…</b><i /></div></PageShell>;
  if (!user) {
    return (
      <PageShell>
        <div className="sv-ok">
          <h3>Inicie sesión para ver las respuestas</h3>
          <p>Solo la persona que creó la encuesta puede ver sus respuestas.</p>
          <Link className="btn navy" to="/">Ir a iniciar sesión</Link>
        </div>
      </PageShell>
    );
  }
  if (survey.isLoading) return <PageShell><div className="ld"><b>Cargando la encuesta…</b><i /></div></PageShell>;
  if (!survey.data) {
    return (
      <PageShell>
        <div className="sv-ok"><h3>No encontramos esta encuesta en su cuenta</h3><Link className="btn navy" to="/">Volver al inicio</Link></div>
      </PageShell>
    );
  }

  const s = survey.data;
  const withIvt = rows.filter((x) => x.idx.ivt !== null);
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const avgIvt = avg(rows.map((x) => x.idx.ivt));
  const dimAvg = DIMENSIONS.map((d) => ({ name: d.label, valor: avg(rows.map((x) => x.idx.dims[d.key])) }));
  const dist = LEVELS.map((l) => ({ name: l.label, hogares: withIvt.filter((x) => x.idx.level?.key === l.key).length, hex: l.hex }));
  const highShare = withIvt.length ? Math.round((withIvt.filter((x) => x.idx.ivt! >= 50).length / withIvt.length) * 100) : null;

  return (
    <PageShell right={<Link className="btn gold" to="/">Mis encuestas</Link>}>
      <div className="resp-head">
        <div>
          <p className="lbl">Procesamiento e indicadores de vulnerabilidad</p>
          <h1>{s.title}</h1>
          <p>{s.is_published ? "La encuesta está abierta y recibe respuestas." : "La encuesta está cerrada; ábrala desde el creador para recibir respuestas."}</p>
        </div>
        {s.is_published && <a className="btn navy" href={`/responder/${s.id}`} target="_blank" rel="noreferrer">Abrir el formulario</a>}
      </div>

      {responses.isLoading ? (
        <div className="ld"><b>Cargando respuestas…</b><i /></div>
      ) : responses.isError ? (
        <p className="empty">No se pudieron cargar las respuestas.</p>
      ) : !rows.length ? (
        <div className="sv-ok"><h3>Todavía no hay respuestas</h3><p>Comparta el enlace o el código QR desde el creador para empezar a recibirlas.</p></div>
      ) : (
        <>
          <div className="kpis">
            <div><small>Hogares encuestados</small><b>{rows.length}</b></div>
            <div><small>IVT promedio</small><b>{fmt(avgIvt)}</b><LevelChip score={avgIvt} /></div>
            <div><small>Hogares en nivel alto o crítico</small><b>{highShare === null ? "—" : highShare + "%"}</b></div>
            <div><small>Última respuesta</small><b className="kpi-date">{new Date(rows[0]!.r.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</b></div>
          </div>
          <div className="res-grid">
            <div className="res-card">
              <h4>Promedio por componente</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dimAvg} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--ink)", fontSize: 13 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--mute)", fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "var(--paper)" }} />
                  <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    {dimAvg.map((d, i) => <Cell key={i} fill={d.valor === null ? "var(--line)" : levelOf(d.valor).hex} />)}
                    <LabelList dataKey="valor" position="top" formatter={(v: number) => fmt(v)} style={{ fill: "var(--ink)", fontWeight: 700, fontSize: 13 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="res-card">
              <h4>Hogares por nivel de vulnerabilidad</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dist} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--ink)", fontSize: 13 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--mute)", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "var(--paper)" }} />
                  <Bar dataKey="hogares" radius={[8, 8, 0, 0]} maxBarSize={64}>
                    {dist.map((d, i) => <Cell key={i} fill={d.hex} />)}
                    <LabelList dataKey="hogares" position="top" style={{ fill: "var(--ink)", fontWeight: 700, fontSize: 13 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="res-card">
            <h4>Respuestas por hogar</h4>
            <div className="resp-table-wrap">
              <table className="resp-table">
                <thead>
                  <tr><th>Fecha</th><th>Hogar</th>{DIMENSIONS.map((d) => <th key={d.key}>{d.label}</th>)}<th>IVT</th><th>Nivel</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map(({ r, idx }) => (
                    <tr key={r.id} className={openId === r.id ? "on" : ""}>
                      <td>{new Date(r.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td><b>{r.household_code ? r.household_code.toUpperCase() : "—"}</b></td>
                      {DIMENSIONS.map((d) => <td key={d.key}>{fmt(idx.dims[d.key])}</td>)}
                      <td><b>{fmt(idx.ivt)}</b></td>
                      <td><LevelChip score={idx.ivt} /></td>
                      <td className="acts">
                        <button className="mini" type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? "Cerrar" : "Ver informe"}</button>
                        <button className="mini danger" type="button" disabled={del.isPending} onClick={() => { if (confirm("¿Eliminar esta respuesta? No se puede deshacer.")) del.mutate(r.id); }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {openId && (() => {
            const sel = rows.find((x) => x.r.id === openId)?.r;
            return sel ? <ResponseDetail key={sel.id} title={s.title} desc={s.description} questions={questions} response={sel} /> : null;
          })()}
        </>
      )}
    </PageShell>
  );
}

function ResponseDetail({ title, desc, questions, response }: { title: string; desc: string; questions: Question[]; response: StoredResponse }) {
  const media = useQuery({ queryKey: ["response-media", response.id], queryFn: () => getResponseMedia(response.id) });
  const prev = useQuery({
    queryKey: ["response-prev", response.id],
    queryFn: () => findPrevious(response.household_code, response.created_at, response.id),
  });
  const data = useMemo(
    () =>
      media.data && prev.isSuccess
        ? {
            title,
            desc,
            questions,
            answers: response.answers,
            media: media.data,
            createdAt: response.created_at,
            responseId: response.id,
            householdCode: response.household_code,
            previous: prev.data ? { createdAt: prev.data.created_at, questions: prev.data.questions, answers: prev.data.answers, surveyTitle: prev.data.surveyTitle } : null,
          }
        : null,
    [media.data, prev.isSuccess, prev.data, title, desc, questions, response],
  );
  return (
    <div className="resp-detail" id="detalle">
      <h3>Informe del hogar {response.household_code ? response.household_code.toUpperCase() : ""}</h3>
      {data ? <ResultsView data={data} /> : <div className="ld"><b>Preparando el informe…</b><i /></div>}
    </div>
  );
}
