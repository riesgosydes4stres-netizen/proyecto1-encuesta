import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import QRCode from "qrcode";
import { toast } from "sonner";
import { surveyLink } from "@/lib/surveys";

interface Props {
  surveyId: string;
  title: string;
  published: boolean;
  busy: boolean;
  onPublish: (next: boolean) => void;
  emailSlot?: ReactNode;
}

export function SharePanel({ surveyId, title, published, busy, onPublish, emailSlot }: Props) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    const l = surveyLink(surveyId);
    setLink(l);
    QRCode.toDataURL(l, { width: 520, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0c2544", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [surveyId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Enlace copiado.");
    } catch {
      toast("No se pudo copiar. Seleccione el enlace y cópielo.");
    }
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = "qr-" + title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="share" aria-label="Compartir la encuesta">
      <div className="share-head">
        <div>
          <p className="lbl">Recibir respuestas</p>
          <h3>Compartir por enlace, código QR o correo</h3>
          <p>Cualquier persona con el enlace puede responder sin crear cuenta. Las respuestas, fotos y firmas solo las ve usted.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={published} disabled={busy} onChange={(e) => onPublish(e.target.checked)} />
          <span aria-hidden="true" />
          <b>{busy ? "Guardando…" : published ? "Abierta" : "Cerrada"}</b>
        </label>
      </div>
      {published ? (
        <div className="share-body">
          <div className="qr">
            {qr ? <img src={qr} alt={`Código QR para responder «${title}»`} width={180} height={180} /> : <div className="qr-ph" />}
            <button className="mini" type="button" onClick={downloadQr} disabled={!qr}>Descargar QR</button>
          </div>
          <div className="share-main">
            <label className="share-link">
              <span>Enlace para responder</span>
              <span className="row">
                <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de la encuesta" />
                <button className="btn navy" type="button" onClick={copy}>Copiar</button>
              </span>
            </label>
            <div className="share-acts">
              <a className="mini" href={link} target="_blank" rel="noreferrer">Abrir el formulario</a>
              <Link className="mini" to="/respuestas/$surveyId" params={{ surveyId }}>Ver respuestas y gráficas</Link>
            </div>
            {emailSlot}
          </div>
        </div>
      ) : (
        <p className="share-off">Active «Abierta» para obtener el enlace y el código QR. Se publica la versión guardada de la encuesta.</p>
      )}
    </div>
  );
}
