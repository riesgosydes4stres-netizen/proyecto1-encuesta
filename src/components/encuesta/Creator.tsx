import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EJEMPLO, iaPedido, parse, slugify, uid, type Question, type QuestionType, type SurveyDoc } from "@/lib/survey-parser";
import { fileBaseName, readDocumentText } from "@/lib/read-document";
import { deleteSurvey, downloadSurveyJson, listSurveys, saveSurvey, setPublished, surveyFromJson } from "@/lib/surveys";
import { Link } from "@tanstack/react-router";
import { SharePanel } from "./SharePanel";
import { generateSurveyText } from "@/lib/ai.functions";
import { useAuth } from "@/hooks/use-auth";
import { SurveyEditor } from "./SurveyEditor";
import { SurveyForm } from "./SurveyForm";

type Panel = "none" | "scratch" | "import" | "manual" | "saved";

const MANUAL_TYPES: { type: QuestionType; icon: string; cls: string; title: string; sub: string }[] = [
  { type: "short", icon: "Aa", cls: "q-blue", title: "Respuesta corta", sub: "Una línea de texto" },
  { type: "long", icon: "¶", cls: "q-violet", title: "Párrafo", sub: "Una respuesta detallada" },
  { type: "single", icon: "◉", cls: "q-gold", title: "Opción única", sub: "Elegir una respuesta" },
  { type: "multi", icon: "☑", cls: "q-green", title: "Varias opciones", sub: "Elegir todas las que aplican" },
  { type: "select", icon: "▾", cls: "q-pink", title: "Lista desplegable", sub: "Elegir de una lista compacta" },
  { type: "scale", icon: "★", cls: "q-orange", title: "Escala 1 a 5", sub: "Medir nivel o satisfacción" },
  { type: "date", icon: "▦", cls: "q-teal", title: "Fecha", sub: "Seleccionar un día" },
  { type: "number", icon: "#", cls: "q-red", title: "Número", sub: "Registrar una cantidad" },
  { type: "grid", icon: "▦", cls: "q-navy", title: "Cuadrícula", sub: "Comparar varias filas" },
  { type: "photo", icon: "◎", cls: "q-blue", title: "Foto de la persona", sub: "Tomar o subir una fotografía" },
  { type: "signature", icon: "✍", cls: "q-gold", title: "Firma", sub: "Firmar con el dedo o el mouse" },
];

const scrollSoon = (el: HTMLElement | null, block: ScrollLogicalPosition = "start") =>
  setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block }), 40);

export function Creator({ onClose, logoStyle }: { onClose: () => void; logoStyle: CSSProperties }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(generateSurveyText);

  const [doc, setDoc] = useState<SurveyDoc | null>(null);
  const [mode, setMode] = useState<"form" | "edit">("form");
  const [showPrev, setShowPrev] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [manualStarted, setManualStarted] = useState(false);
  const [paste, setPaste] = useState("");
  const [dragOn, setDragOn] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // IA
  const [iaTema, setIaTema] = useState("");
  const [iaDoc, setIaDoc] = useState("");
  const [iaDocName, setIaDocName] = useState("");
  const [iaBusy, setIaBusy] = useState(false);
  const [iaMsg, setIaMsg] = useState("");

  const prevRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const temaRef = useRef<HTMLTextAreaElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => temaRef.current?.focus({ preventScroll: true }), 450);
    return () => clearTimeout(t);
  }, []);

  const saved = useQuery({ queryKey: ["surveys", user?.id], queryFn: () => listSurveys(user!.id), enabled: !!user });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !doc) throw new Error("Primero cree su cuenta o inicie sesión.");
      if (!doc.questions.some((q) => q.text.trim())) throw new Error("Agregue al menos una pregunta con texto.");
      return saveSurvey(user.id, doc, currentId);
    },
    onSuccess: (id) => {
      setCurrentId(id);
      void qc.invalidateQueries({ queryKey: ["surveys"] });
      toast("Encuesta guardada en su cuenta.");
    },
    onError: (e: Error) => toast(e.message),
  });

  const publishMut = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user || !doc || !currentId) throw new Error("Primero guarde la encuesta.");
      if (next) await saveSurvey(user.id, doc, currentId);
      await setPublished(currentId, next);
      return next;
    },
    onSuccess: (next) => {
      void qc.invalidateQueries({ queryKey: ["surveys"] });
      toast(next ? "Encuesta abierta: ya puede compartir el enlace o el código QR." : "Encuesta cerrada: ya no recibe respuestas.");
    },
    onError: (e: Error) => toast(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteSurvey,
    onSuccess: (_, id) => {
      if (id === currentId) setCurrentId(null);
      void qc.invalidateQueries({ queryKey: ["surveys"] });
      toast("Encuesta eliminada.");
    },
    onError: (e: Error) => toast(e.message),
  });

  const showDoc = (d: SurveyDoc, m: "form" | "edit" = "form") => {
    setDoc(d);
    setMode(m);
    setShowPrev(true);
    scrollSoon(prevRef.current);
  };

  const build = (text: string, auto: boolean, fname = "") => {
    const t = text.trim();
    if (!t) {
      if (!auto) toast("Escriba, pegue o cargue un documento primero.");
      return;
    }
    setManualStarted(false);
    setCurrentId(null);
    const d = parse(t, fname);
    if (!d.questions.length) {
      setShowPrev(false);
      toast("No se encontraron preguntas. Revise la guía de formato.");
      return;
    }
    showDoc(d);
    if (auto) toast("Encuesta creada: " + d.questions.length + (d.questions.length === 1 ? " pregunta detectada." : " preguntas detectadas."));
  };

  const readDoc = async (f: File | undefined) => {
    if (!f) return;
    const fname = fileBaseName(f);
    setLoadingDoc(true);
    setShowPrev(true);
    try {
      const t = await readDocumentText(f);
      setPaste(t);
      setLoadingDoc(false);
      build(t, true, fname);
    } catch (e) {
      setLoadingDoc(false);
      setShowPrev(false);
      toast(e instanceof Error ? e.message : "No se pudo leer el documento.");
    }
  };

  const openPanel = (p: Panel) => {
    setPanel(p);
    setShowPrev(false);
    if (p === "scratch") scrollSoon(scratchRef.current);
    if (p === "import") {
      scrollSoon(importRef.current);
      setTimeout(() => pasteRef.current?.focus({ preventScroll: true }), 350);
    }
    if (p === "saved") scrollSoon(savedRef.current);
    if (p === "manual") {
      if (!manualStarted) {
        setDoc({ title: "", desc: "", questions: [] });
        setMode("edit");
        setManualStarted(true);
        setCurrentId(null);
      } else if (doc && doc.questions.length) setShowPrev(true);
      scrollSoon(manualRef.current);
    }
  };

  const addManual = (type: QuestionType) => {
    const base = doc ?? { title: "", desc: "", questions: [] };
    const nq: Question = { id: uid(), type, text: "", req: false, sec: "", opts: [] };
    if (type === "single" || type === "multi" || type === "select") nq.opts = ["Opción 1", "Opción 2"];
    if (type === "grid") {
      nq.rows = ["Fila 1", "Fila 2"];
      nq.cols = ["Sí", "No"];
    }
    showDoc({ ...base, questions: [...base.questions, nq] }, "edit");
    setTimeout(() => {
      const fields = prevRef.current?.querySelectorAll<HTMLInputElement>('[data-q="text"]');
      fields?.[fields.length - 1]?.focus({ preventScroll: true });
    }, 250);
  };

  const onIaFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const t = await readDocumentText(f);
      if (!t.trim()) throw new Error("El documento está vacío.");
      setIaDoc(t);
      setIaDocName(f.name);
      toast("Documento adjunto. Pulse «Generar con IA».");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const onIaGo = async () => {
    const pedido = iaPedido(iaTema, iaDoc);
    if (!pedido) {
      toast("Describa la encuesta o adjunte un documento primero.");
      temaRef.current?.focus();
      return;
    }
    setIaBusy(true);
    setIaMsg("Conectando con la IA… puede tardar unos segundos.");
    try {
      const r = await generate({ data: { prompt: pedido } });
      if ("error" in r) throw new Error(r.error);
      const out = r.text.replace(/```[a-z]*\n?/gi, "").trim();
      if (!out) throw new Error("La IA no devolvió texto.");
      setPaste(out);
      setIaMsg("");
      build(out, true);
    } catch (e) {
      const m = "No se pudo generar: " + (e instanceof Error ? e.message : "error de conexión") + ".";
      setIaMsg("⚠ " + m);
      toast(m);
    } finally {
      setIaBusy(false);
    }
  };

  const onIaCopy = async () => {
    const pedido = iaPedido(iaTema, iaDoc);
    if (!pedido) {
      toast("Describa la encuesta o adjunte un documento primero.");
      temaRef.current?.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(pedido);
    } catch {
      /* clipboard unavailable */
    }
    openPanel("import");
    toast("Instrucciones copiadas. Pégalas en tu IA y luego pega aquí la respuesta.");
  };

  const onDownload = () => {
    if (!doc || !doc.questions.some((q) => q.text.trim())) {
      toast("Agregue al menos una pregunta con texto.");
      return;
    }
    try {
      downloadSurveyJson(doc, slugify(doc.title.trim() || "Encuesta sin título"));
      toast("Archivo generado. Puede abrirlo luego con «Abrir archivo».");
    } catch {
      toast("No se pudo descargar en este entorno.");
    }
  };

  const onOpenJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const d = surveyFromJson(JSON.parse(await f.text()));
      setCurrentId(null);
      setManualStarted(false);
      showDoc(d);
      toast("Encuesta abierta. Pulse «Guardar en mi cuenta» para conservarla.");
    } catch (e) {
      toast(e instanceof Error && e.message !== "" && !(e instanceof SyntaxError) ? e.message : "El archivo no es una encuesta válida (.json).");
    }
  };

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => { e.preventDefault(); setDragOn(true); },
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragOn(true); },
    onDragLeave: (e: DragEvent) => { e.preventDefault(); setDragOn(false); },
    onDrop: (e: DragEvent) => { e.preventDefault(); setDragOn(false); void readDoc(e.dataTransfer.files[0]); },
  };

  const n = doc?.questions.length ?? 0;
  const ns = doc ? new Set(doc.questions.map((q) => q.sec).filter(Boolean)).size : 0;
  const nr = doc ? doc.questions.filter((q) => q.req).length : 0;
  const au = doc ? doc.questions.filter((q) => q.auto && q.text.trim()) : [];
  const hasQuestions = !!doc && doc.questions.length > 0;
  const current = currentId ? saved.data?.find((s) => s.id === currentId) : undefined;

  return (
    <section className="docs" id="documento" aria-label="Creador de encuestas">
      <div className="wrap creator-flow">
        <div className="creator-heading">
          <div>
            <p className="lbl">Creador de encuestas</p>
            <h2>¿Cómo quieres crearla?</h2>
            <p>Genera un primer borrador con IA o empieza desde cero y elige cómo armar tus preguntas.</p>
          </div>
          <button className="btn line" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="ia">
          <h3>Crear con IA</h3>
          <p className="sub">Describe el tema, a quién va dirigida y cuántas preguntas necesitas. La IA redacta una propuesta para que la revises.</p>
          <textarea
            ref={temaRef}
            value={iaTema}
            onChange={(e) => setIaTema(e.target.value)}
            aria-label="Describe la encuesta que necesitas"
            placeholder="Ej.: Encuesta de 10 preguntas para conocer la satisfacción con el servicio de agua."
          />
          <label className="drop" htmlFor="iaFile">
            <b>{iaDocName ? "Documento adjunto: " + iaDocName : "Adjuntar un documento (opcional)"}</b>
            <span>.docx, .txt o .md · la IA lo lee y lo convierte en encuesta</span>
          </label>
          <input type="file" id="iaFile" accept=".docx,.txt,.md,text/plain" hidden onChange={(e) => { void onIaFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="docacts">
            <button className="btn navy" type="button" onClick={onIaGo} disabled={iaBusy}>
              {iaBusy ? "Redactando la encuesta…" : "Generar con IA"}
            </button>
            <button className="btn line" type="button" onClick={onIaCopy}>Copiar instrucciones para otra IA</button>
          </div>
          <p className="ia-msg" role="status">{iaMsg}</p>
          <p className="ia-msg">No incluya nombres, números de documento, teléfonos ni datos de salud en el texto que envía a la IA.</p>
        </div>

        <p className="sep">— o elige una forma de creación manual —</p>
        <button className="start-card" type="button" aria-expanded={panel === "scratch"} onClick={() => openPanel("scratch")}>
          <span className="start-icon" aria-hidden="true">✦</span>
          <span className="start-copy">
            <strong>Prefiero empezar desde cero</strong>
            <small>Importa preguntas existentes o crea tu encuesta paso a paso.</small>
          </span>
          <span className="start-action">Ver opciones <span aria-hidden="true">→</span></span>
        </button>
        <button className="start-card" type="button" style={{ marginTop: 12 }} aria-expanded={panel === "saved"} onClick={() => openPanel("saved")}>
          <span className="start-icon" aria-hidden="true">☰</span>
          <span className="start-copy">
            <strong>Mis encuestas guardadas</strong>
            <small>Abra, descargue o elimine las encuestas de su cuenta, o abra un archivo .json.</small>
          </span>
          <span className="start-action">Ver lista <span aria-hidden="true">→</span></span>
        </button>

        {panel === "scratch" && (
          <div className="scratch-options" ref={scratchRef}>
            <div className="panel-heading"><div><h3>Elige cómo quieres empezar</h3><p>Ambas opciones te permiten revisar y editar cada pregunta.</p></div></div>
            <div className="method-grid">
              <button className="method-card method-import" type="button" onClick={() => openPanel("import")}>
                <span className="method-icon" aria-hidden="true">📄</span>
                <strong>Usar un documento</strong>
                <span>Sube un Word o pega una lista de preguntas para convertirla en encuesta.</span>
                <b>Importar preguntas <span aria-hidden="true">→</span></b>
              </button>
              <button className="method-card method-manual" type="button" onClick={() => openPanel("manual")}>
                <span className="method-icon" aria-hidden="true">✍️</span>
                <strong>Crear manualmente</strong>
                <span>Diseña el formulario desde cero y elige el formato de cada pregunta.</span>
                <b>Elegir tipos de pregunta <span aria-hidden="true">→</span></b>
              </button>
            </div>
          </div>
        )}

        {panel === "import" && (
          <div className="import-panel" ref={importRef} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={(e) => { if ((e.target as HTMLElement).closest(".drop")) return; if (e.dataTransfer.files.length) { e.preventDefault(); void readDoc(e.dataTransfer.files[0]); } }}>
            <div className="panel-heading">
              <div><p className="lbl">Importar contenido</p><h3>Sube o pega tus preguntas</h3><p>Al cargar el documento o pegar el texto, detectaré las preguntas y sus opciones.</p></div>
              <button className="back-btn" type="button" onClick={() => openPanel("scratch")}>← Cambiar opción</button>
            </div>
            <label className={"drop" + (dragOn ? " on" : "")} htmlFor="docfile" {...dropHandlers}>
              <b>Suelta aquí tu documento</b>
              <span>o toca para elegirlo · .docx, .txt, .md</span>
            </label>
            <input type="file" id="docfile" accept=".docx,.txt,.md,text/plain" hidden onChange={(e) => { void readDoc(e.target.files?.[0]); e.target.value = ""; }} />
            <textarea
              ref={pasteRef}
              className="paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onPaste={(e) => {
                const fs = e.clipboardData.files;
                if (fs.length) {
                  e.preventDefault();
                  void readDoc(fs[0]);
                  return;
                }
                const pasted = e.clipboardData.getData("text");
                const el = e.currentTarget;
                setTimeout(() => build(el.value || pasted, true), 80);
              }}
              aria-label="Texto del documento"
              placeholder="También puedes pegar aquí tus preguntas. La encuesta se crea al instante."
            />
            <div className="docacts">
              <button className="btn navy" type="button" onClick={() => build(paste, false)}>Crear encuesta desde el texto</button>
              <button className="btn line" type="button" onClick={() => { setPaste(EJEMPLO); build(EJEMPLO, false); }}>Probar con un ejemplo</button>
            </div>
            <details className="guide">
              <summary>Cómo preparar el documento</summary>
              <ul className="how">
                <li>La primera línea es el título.</li>
                <li>Cada pregunta va en su línea, con número («1.») o entre signos de interrogación.</li>
                <li>Las opciones van debajo, con guion o letra: «- Sí» o «a) Sí».</li>
                <li>Sin opciones, la pregunta será de respuesta corta.</li>
                <li>Al final de la pregunta puede añadir: <b>(varias)</b>, <b>(escala)</b>, <b>(párrafo)</b>, <b>(matriz)</b> (con «Filas: a | b» y «Columnas: x | y» debajo), <b>(fecha)</b>, <b>(número)</b>, <b>(desplegable)</b>, <b>(foto)</b>, <b>(firma)</b> o <b>*</b> si es obligatoria.</li>
                <li>Para agrupar preguntas escriba una línea «Sección: Nombre» antes de ellas.</li>
              </ul>
              <pre>{EJEMPLO}</pre>
            </details>
          </div>
        )}

        {panel === "manual" && (
          <div className="manual-panel" ref={manualRef}>
            <div className="panel-heading">
              <div><p className="lbl">Crear manualmente</p><h3>Elige un tipo de pregunta</h3><p>Selecciona una tarjeta para agregarla. Puedes combinar varios formatos.</p></div>
              <button className="back-btn" type="button" onClick={() => openPanel("scratch")}>← Cambiar opción</button>
            </div>
            <div className="manual-types" aria-label="Tipos de pregunta">
              {MANUAL_TYPES.map((t) => (
                <button className="question-type-card" type="button" key={t.type} onClick={() => addManual(t.type)}>
                  <span className={"qtype-icon " + t.cls} aria-hidden="true">{t.icon}</span>
                  <strong>{t.title}</strong>
                  <small>{t.sub}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {panel === "saved" && (
          <div className="saved-panel" ref={savedRef}>
            <div className="panel-heading">
              <div><p className="lbl">Mi cuenta</p><h3>Mis encuestas guardadas</h3><p>Se guardan en su cuenta y puede abrirlas desde cualquier dispositivo.</p></div>
              <button className="back-btn" type="button" onClick={() => jsonInputRef.current?.click()}>Abrir archivo (.json)</button>
            </div>
            <input ref={jsonInputRef} type="file" accept=".json,application/json" hidden onChange={(e) => { void onOpenJson(e.target.files?.[0]); e.target.value = ""; }} />
            {saved.isLoading ? (
              <div className="ld"><b>Cargando sus encuestas…</b><i /></div>
            ) : saved.isError ? (
              <p className="empty">No se pudieron cargar sus encuestas.</p>
            ) : !saved.data?.length ? (
              <p className="empty">Todavía no tiene encuestas guardadas. Cree una y pulse «Guardar en mi cuenta».</p>
            ) : (
              <ul className="saved-list">
                {saved.data.map((s) => (
                  <li key={s.id}>
                    <div className="meta">
                      <strong>{s.title} {s.is_published && <span className="tag-open">Abierta</span>}</strong>
                      <small>
                        {s.questions.length} {s.questions.length === 1 ? "pregunta" : "preguntas"} · actualizada el{" "}
                        {new Date(s.updated_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </small>
                    </div>
                    <div className="acts">
                      <button className="mini" type="button" onClick={() => { setCurrentId(s.id); setManualStarted(false); showDoc({ title: s.title, desc: s.description, questions: s.questions }); }}>Abrir</button>
                      <Link className="mini" to="/respuestas/$surveyId" params={{ surveyId: s.id }}>Respuestas</Link>
                      <button className="mini" type="button" onClick={() => downloadSurveyJson({ title: s.title, desc: s.description, questions: s.questions }, slugify(s.title))}>Descargar</button>
                      <button
                        className="mini danger"
                        type="button"
                        disabled={delMut.isPending}
                        onClick={() => { if (confirm(`¿Eliminar «${s.title}»? Esta acción no se puede deshacer.`)) delMut.mutate(s.id); }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showPrev && (
          <div className="prev" ref={prevRef} aria-live="polite">
            {loadingDoc ? (
              <div className="ld"><b>Leyendo el documento y detectando las preguntas…</b><i /></div>
            ) : doc && hasQuestions ? (
              <>
                <h3>
                  {n} {n === 1 ? "pregunta detectada" : "preguntas detectadas"}.{mode === "edit" ? " Revíselas y ajústelas." : ""}
                </h3>
                <p className="chips"><span>{n} preguntas</span><span>{ns} secciones</span><span>{nr} obligatorias</span></p>
                {au.length > 0 && (
                  <div className="rv">
                    <b>Revise:</b> {au.map((q) => "«" + q.text + "»").join(", ")} no traía opciones; se dejaron dos de ejemplo. Cámbielas en «Editar preguntas».
                  </div>
                )}
                <div className="pa" style={{ margin: "0 0 20px" }}>
                  <button className={"btn " + (mode === "form" ? "navy" : "line")} type="button" onClick={() => setMode("form")}>Ver la encuesta</button>
                  <button className={"btn " + (mode === "edit" ? "navy" : "line")} type="button" onClick={() => setMode("edit")}>Editar preguntas</button>
                </div>
                {mode === "form" ? <SurveyForm doc={doc} logoStyle={logoStyle} /> : <SurveyEditor doc={doc} onChange={setDoc} />}
                <div className="pa">
                  <button className="btn navy" type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    {saveMut.isPending ? "Guardando…" : currentId ? "Guardar cambios" : "Guardar en mi cuenta"}
                  </button>
                  <button className="btn line" type="button" onClick={onDownload}>Descargar la encuesta (.json)</button>
                  {mode === "edit" && (
                    <button className="btn line" type="button" onClick={() => setDoc({ ...doc, questions: [...doc.questions, { id: uid(), type: "short", text: "", req: false, sec: "", opts: [] }] })}>
                      Agregar una pregunta
                    </button>
                  )}
                </div>
                <p className="note">La encuesta queda guardada en su cuenta y la encuentra en «Mis encuestas guardadas». También puede descargarla y abrirla luego con «Abrir archivo».</p>
                {currentId ? (
                  <SharePanel
                    surveyId={currentId}
                    title={doc.title || "Encuesta"}
                    published={!!current?.is_published}
                    busy={publishMut.isPending}
                    onPublish={(next) => publishMut.mutate(next)}
                  />
                ) : (
                  <p className="note">Para compartirla por enlace, código QR o correo, primero pulse «Guardar en mi cuenta».</p>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
