import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPublicSurvey } from "@/lib/public-survey.functions";
import { findPrevious, submitResponse } from "@/lib/responses";
import { splitMedia, type Answers } from "@/lib/vulnerability";
import { useAuth } from "@/hooks/use-auth";
import { PageShell, logoStyle } from "@/components/encuesta/PageShell";
import { SurveyForm } from "@/components/encuesta/SurveyForm";
import { ResultsView, type ResultsData } from "@/components/encuesta/ResultsView";

const surveyQuery = (id: string) =>
  queryOptions({ queryKey: ["public-survey", id], queryFn: () => getPublicSurvey({ data: { id } }) });

export const Route = createFileRoute("/responder/$surveyId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(surveyQuery(params.surveyId)),
  head: ({ loaderData }) => {
    const t = loaderData?.survey ? `${loaderData.survey.title} · Responder encuesta · UNGRD` : "Encuesta no disponible · UNGRD";
    const d = loaderData?.survey?.description || "Responda esta encuesta de seguimiento a comunidades reasentadas de la UNGRD.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: Responder,
  errorComponent: () => (
    <PageShell>
      <div className="sv-ok"><h3>Enlace inválido</h3><p>Revise el enlace o pida uno nuevo a quien se lo compartió.</p></div>
    </PageShell>
  ),
});

function Responder() {
  const { surveyId } = Route.useParams();
  const { data } = useSuspenseQuery(surveyQuery(surveyId));
  const { user } = useAuth();
  const [result, setResult] = useState<ResultsData | null>(null);
  const [round, setRound] = useState(0);
  const s = data.survey;

  if (!s) {
    return (
      <PageShell>
        <div className="sv-ok">
          <h3>Esta encuesta no está disponible</h3>
          <p>Puede que se haya cerrado o que el enlace no sea correcto. Consulte con quien se la compartió.</p>
          <Link className="btn navy" to="/">Ir al inicio</Link>
        </div>
      </PageShell>
    );
  }

  const isOwner = !!user && user.id === s.ownerId;

  const onSubmit = async (all: Answers) => {
    const r = await submitResponse(s.id, s.questions, all);
    const { answers, media } = splitMedia(s.questions, all);
    let previous: ResultsData["previous"] = null;
    if (isOwner && r.code) {
      const p = await findPrevious(r.code, r.createdAt, r.id);
      if (p) previous = { createdAt: p.created_at, questions: p.questions, answers: p.answers, surveyTitle: p.surveyTitle };
    }
    setResult({
      title: s.title,
      desc: s.description,
      questions: s.questions,
      answers,
      media,
      createdAt: r.createdAt,
      responseId: r.id,
      householdCode: r.code,
      previous,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <PageShell right={isOwner ? <Link className="btn gold" to="/respuestas/$surveyId" params={{ surveyId: s.id }}>Ver respuestas</Link> : undefined}>
      {result ? (
        <div className="sv">
          <div className="sv-ok">
            <h3>¡Respuestas enviadas!</h3>
            <p>Gracias. Abajo encuentra el resultado del hogar y puede descargar el informe en PDF.</p>
          </div>
          <ResultsView
            data={result}
            actions={
              <button className="btn line" type="button" onClick={() => { setResult(null); setRound((n) => n + 1); window.scrollTo({ top: 0 }); }}>
                Responder otra encuesta
              </button>
            }
          />
        </div>
      ) : (
        <SurveyForm key={round} doc={{ title: s.title, desc: s.description, questions: s.questions }} logoStyle={logoStyle} onSubmit={onSubmit} />
      )}
    </PageShell>
  );
}
