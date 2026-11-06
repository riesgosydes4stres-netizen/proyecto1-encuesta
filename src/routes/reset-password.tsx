import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import logo from "@/assets/ungrd-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Emblem } from "@/components/encuesta/Emblem";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · Gestión social y productiva para familia en reasentamiento" },
      { name: "description", content: "Cree una nueva contraseña para su cuenta del Creador de encuestas de la UNGRD." },
      { property: "og:title", content: "Nueva contraseña · UNGRD" },
      { property: "og:description", content: "Cree una nueva contraseña para su cuenta del Creador de encuestas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("pw") ?? "");
    setErr("");
    if (pw.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (pw !== String(f.get("pw2") ?? "")) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr("No se pudo cambiar la contraseña. Pida un enlace nuevo e intente otra vez.");
    toast("Contraseña actualizada. Su sesión está abierta.");
    void navigate({ to: "/" });
  };

  return (
    <div className="encuesta" style={{ "--logo": `url("${logo.url}")` } as CSSProperties}>
      <div className="reset-wrap">
        <div className="auth">
          <Emblem />
          <h2>Nueva contraseña</h2>
          {ready ? (
            <>
              <p>Escriba la contraseña que usará a partir de ahora.</p>
              <form onSubmit={onSubmit} noValidate>
                <label>
                  Nueva contraseña
                  <input type="password" name="pw" autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
                </label>
                <label>
                  Repetir contraseña
                  <input type="password" name="pw2" autoComplete="new-password" />
                </label>
                {err && <div className="err" role="alert">{err}</div>}
                <button className="btn gold" type="submit" disabled={busy}>Guardar contraseña</button>
              </form>
            </>
          ) : (
            <p>Abra esta página desde el enlace que le enviamos por correo. Si el enlace venció, pida uno nuevo en «¿Olvidó su contraseña?».</p>
          )}
          <a className="btn ghost" href="/">Volver al inicio</a>
        </div>
      </div>
    </div>
  );
}
