import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Resizes a photo to max 900px and returns a JPEG data URL (~100 KB). */
async function compressImage(file: File, max = 900, quality = 0.75): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the current video frame to a JPEG data URL (max 900px). */
function frameToJpeg(v: HTMLVideoElement, max = 900, quality = 0.75): string {
  const s = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * s);
  c.height = Math.round(v.videoHeight * s);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

function LiveCamera({ onShot, onCancel, onFail }: { onShot: (v: string) => void; onCancel: () => void; onFail: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          void v.play().then(() => setReady(true));
        }
      })
      .catch(() => {
        if (!cancelled) onFail();
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  return (
    <div className="cam">
      <video ref={videoRef} playsInline muted aria-label="Vista de la cámara" />
      {!ready && <p className="cam-wait">Abriendo la cámara…</p>}
      <div className="photo-acts">
        <button
          type="button"
          className="btn navy"
          disabled={!ready}
          onClick={() => videoRef.current && onShot(frameToJpeg(videoRef.current))}
        >
          Capturar foto
        </button>
        <button type="button" className="btn line" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
          Cambiar cámara
        </button>
        <button type="button" className="mini" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export function PhotoInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  const openCamera = () => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // Phones/tablets: the native camera app. Computers: live webcam view.
    if (!touch && typeof navigator.mediaDevices?.getUserMedia === "function") setLive(true);
    else camRef.current?.click();
  };

  if (live)
    return (
      <div className="photo-in" id={id}>
        <LiveCamera
          onShot={(v) => { onChange(v); setLive(false); }}
          onCancel={() => setLive(false)}
          onFail={() => {
            setLive(false);
            toast("No se pudo abrir la cámara. Revise el permiso del navegador o cargue una foto.");
          }}
        />
      </div>
    );

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast("Elija una imagen (JPG o PNG).");
      return;
    }
    setBusy(true);
    try {
      onChange(await compressImage(f));
    } catch {
      toast("No se pudo leer la foto. Intente con otra imagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-in" id={id}>
      {value ? (
        <figure className="photo-prev">
          <img src={value} alt="Foto de la persona encuestada" />
          <button type="button" className="mini danger" onClick={() => onChange("")}>Quitar foto</button>
        </figure>
      ) : (
        <div className="photo-empty" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
        </div>
      )}
      <div className="photo-acts">
        <button type="button" className="btn navy" disabled={busy} onClick={openCamera}>
          {busy ? "Procesando…" : value ? "Tomar otra foto" : "Tomar foto"}
        </button>
        <button type="button" className="btn line" disabled={busy} onClick={() => galRef.current?.click()}>
          {value ? "Cargar otra foto" : "Cargar foto"}
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

export function SignaturePad({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drew = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#0c2544";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = value;
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#0c2544";
      ctx.fill();
    }
    drew.current = true;
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const p = pos(e);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (drew.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    drew.current = false;
    onChange("");
  };

  return (
    <div className="sigpad" id={id}>
      <canvas
        ref={canvasRef}
        aria-label="Área para firmar con el dedo o el mouse"
        role="img"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      />
      <div className="sig-line" aria-hidden="true">Firme aquí</div>
      <div className="sig-acts">
        <span>{value ? "Firma registrada." : "Firme con el dedo o con el mouse."}</span>
        <button type="button" className="mini" onClick={clear}>Borrar firma</button>
      </div>
    </div>
  );
}
