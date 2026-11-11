import { useEffect, useState } from "react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/pdf-download";

interface Props {
  /** Builds the PDF to send. Called once when the panel opens. */
  prepare: () => Promise<Blob>;
  filename: string;
  subject: string;
  body: string;
  label?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the PDF through the user's own email: on phones the share sheet attaches the file;
 * on computers the PDF is downloaded and Gmail, Outlook or the default mail program opens
 * with the message ready, so the user only attaches the downloaded file.
 */
export function EmailShare({ prepare, filename, subject, body, label = "Enviar por correo" }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);

  useEffect(() => {
    if (!open || blob) return;
    let alive = true;
    setFailed(false);
    prepare()
      .then((b) => {
        if (!alive) return;
        setBlob(b);
        try {
          const touch = matchMedia("(pointer: coarse)").matches;
          const file = new File([b], filename, { type: "application/pdf" });
          setCanShareFile(touch && !!navigator.canShare?.({ files: [file] }));
        } catch {
          setCanShareFile(false);
        }
      })
      .catch((e) => {
        console.error(e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const recipient = to.trim();
  const check = () => {
    if (recipient && !EMAIL_RE.test(recipient)) {
      toast("Revise el correo del destinatario.");
      return false;
    }
    return true;
  };
  const fullBody = `${body}\n\nAdjunto: ${filename}`;

  const shareFile = async () => {
    if (!blob || !check()) return;
    const file = new File([blob], filename, { type: "application/pdf" });
    try {
      await navigator.share({ files: [file], title: subject, text: body });
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") toast("No se pudo compartir. Pruebe con otra opción.");
    }
  };

  const openMail = (kind: "gmail" | "outlook" | "default") => {
    if (!blob || !check()) return;
    const e = encodeURIComponent;
    const url =
      kind === "gmail"
        ? `https://mail.google.com/mail/?view=cm&fs=1&to=${e(recipient)}&su=${e(subject)}&body=${e(fullBody)}`
        : kind === "outlook"
          ? `https://outlook.office.com/mail/deeplink/compose?to=${e(recipient)}&subject=${e(subject)}&body=${e(fullBody)}`
          : `mailto:${e(recipient)}?subject=${e(subject)}&body=${e(fullBody)}`;
    downloadBlob(blob, filename);
    if (kind === "default") window.location.href = url;
    else window.open(url, "_blank", "noopener");
    toast("El PDF se descargó. Adjúntelo al mensaje que se abrió y pulse Enviar.");
  };

  if (!open)
    return (
      <button className="btn line" type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
    );

  return (
    <div className="mail-box" role="group" aria-label="Enviar por correo">
      <div className="mail-head">
        <strong>Enviar el PDF por correo</strong>
        <button className="mini" type="button" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
      <label>
        Correo del destinatario
        <input type="email" inputMode="email" autoComplete="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="nombre@entidad.gov.co (opcional)" />
      </label>
      {failed ? (
        <p className="err" role="alert">No se pudo preparar el PDF. Cierre e intente de nuevo.</p>
      ) : !blob ? (
        <p className="mail-note">Preparando el PDF…</p>
      ) : (
        <>
          <div className="mail-acts">
            {canShareFile && (
              <button className="btn gold" type="button" onClick={() => void shareFile()}>Compartir con el PDF adjunto</button>
            )}
            <button className={"btn " + (canShareFile ? "line" : "navy")} type="button" onClick={() => openMail("gmail")}>Gmail</button>
            <button className="btn line" type="button" onClick={() => openMail("outlook")}>Outlook</button>
            <button className="btn line" type="button" onClick={() => openMail("default")}>Otro programa de correo</button>
          </div>
          <p className="mail-note">
            {canShareFile
              ? "«Compartir» adjunta el PDF directamente en la aplicación de correo que elija."
              : "Se descarga el PDF y se abre un correo ya redactado. Solo adjunte el archivo descargado y pulse Enviar."}
          </p>
        </>
      )}
    </div>
  );
}
