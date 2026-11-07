import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { PersonalInfoPanel } from "./PersonalInfoPanel";

export type AuthMode = "register" | "login" | "forgot";

interface Props {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onOpenCreator: () => void;
  onSignedOut: () => void;
}

export function AuthBox({ mode, setMode, onOpenCreator, onSignedOut }: Props) {
  const { user, name: userName } = useAuth();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setErr("");
    setOk("");
  };

  if (user) {
    return (
      <div>
        <h2>Hola, {userName}</h2>
        <p>Su sesión está abierta en este dispositivo.</p>
        <PersonalInfoPanel />
        <button className="btn gold" type="button" onClick={onOpenCreator}>
          Ir al Creador de encuestas
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            setMode("login");
            onSignedOut();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  const onGoogle = async () => {
    setErr("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setErr("No se pudo continuar con Google. Intente de nuevo.");
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const em = String(f.get("email") ?? "").trim().toLowerCase();
    const pw = String(f.get("pw") ?? "");
    setEmail(em);
    setErr("");
    setOk("");
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr("Escriba un correo válido.");
    if (mode === "forgot") {
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return setErr("No se pudo enviar el correo. Intente de nuevo.");
      return setOk("Si existe una cuenta con ese correo, recibirá un enlace para crear una nueva contraseña.");
    }
    if (pw.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    setBusy(true);
    try {
      if (mode === "register") {
        const nm = String(f.get("name") ?? "").trim();
        setName(nm);
        if (!nm) return setErr("Escriba su nombre.");
        if (pw !== String(f.get("pw2") ?? "")) return setErr("Las contraseñas no coinciden.");
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: { data: { name: nm }, emailRedirectTo: window.location.origin },
        });
        if (error) {
          return setErr(
            /already|registered/i.test(error.message)
              ? "Ya existe una cuenta con ese correo. Inicie sesión."
              : /not allowed|invalid.*email|email.*invalid/i.test(error.message)
                ? "Ese correo no puede recibir mensajes. Revise que esté bien escrito."
                : /weak|pwned|leaked/i.test(error.message)
                ? "Esa contraseña es muy fácil de adivinar. Elija otra."
                : "No se pudo crear la cuenta. Intente de nuevo.",
          );
        }
        if (!data.session) {
          return setOk("Le enviamos un correo para confirmar su cuenta. Ábralo y luego inicie sesión.");
        }
        toast("Sesión abierta. Ya puede usar el Creador de encuestas.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) {
          return setErr(
            /confirm/i.test(error.message)
              ? "Primero confirme su correo con el enlace que le enviamos."
              : "Correo o contraseña incorrectos.",
          );
        }
        toast("Sesión abierta. Ya puede usar el Creador de encuestas.");
      }
    } catch {
      setErr("No se pudo procesar. Intente de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const reg = mode === "register";
  const forgot = mode === "forgot";

  return (
    <div>
      {!forgot && (
        <div className="tabs">
          <button type="button" className={reg ? "on" : ""} onClick={() => switchMode("register")}>
            Registrarse
          </button>
          <button type="button" className={reg ? "" : "on"} onClick={() => switchMode("login")}>
            Iniciar sesión
          </button>
        </div>
      )}
      <h2>{forgot ? "Recuperar contraseña" : reg ? "Cree su cuenta" : "Bienvenido de nuevo"}</h2>
      <p>
        {forgot
          ? "Le enviaremos un enlace a su correo."
          : reg
            ? "Para crear y guardar sus encuestas."
            : "Entre para ver sus encuestas."}
      </p>
      <form onSubmit={onSubmit} noValidate key={mode}>
        {reg && (
          <label>
            Nombre
            <input type="text" name="name" autoComplete="name" defaultValue={name} placeholder="Su nombre" />
          </label>
        )}
        <label>
          Correo electrónico
          <input type="email" name="email" autoComplete="email" defaultValue={email} placeholder="correo@ejemplo.com" />
        </label>
        {!forgot && (
          <label>
            Contraseña
            <input
              type="password"
              name="pw"
              autoComplete={reg ? "new-password" : "current-password"}
              placeholder="Mínimo 6 caracteres"
            />
          </label>
        )}
        {reg && (
          <label>
            Repetir contraseña
            <input type="password" name="pw2" autoComplete="new-password" />
          </label>
        )}
        {err && <div className="err" role="alert">{err}</div>}
        {ok && <div className="ok" role="status">{ok}</div>}
        <button className="btn gold" type="submit" disabled={busy}>
          {forgot ? "Enviar enlace" : reg ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
      {mode === "login" && (
        <button type="button" className="linkish" onClick={() => switchMode("forgot")}>
          ¿Olvidó su contraseña?
        </button>
      )}
      {forgot && (
        <button type="button" className="linkish" onClick={() => switchMode("login")}>
          ← Volver a iniciar sesión
        </button>
      )}
      {!forgot && (
        <>
          <div className="or">o</div>
          <button type="button" className="btn google" onClick={onGoogle}>
            Continuar con Google
          </button>
        </>
      )}
    </div>
  );
}
