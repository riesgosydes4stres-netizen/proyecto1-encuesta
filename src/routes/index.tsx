import { useRef, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import logo from "@/assets/ungrd-logo.jpg.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { Emblem } from "@/components/encuesta/Emblem";
import { AuthBox, type AuthMode } from "@/components/encuesta/AuthBox";
import { Creator } from "@/components/encuesta/Creator";
import { Facts, Herramientas, Mide, Pasos, Ruta, SiteFooter } from "@/components/encuesta/LandingSections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seguimiento a comunidades reasentadas · UNGRD" },
      { name: "description", content: "Herramienta de campo para dar seguimiento a los hogares reasentados tras el sismo de 2025." },
      { property: "og:title", content: "Seguimiento a comunidades reasentadas · UNGRD" },
      { property: "og:description", content: "Registre, mida y reporte la situación de los hogares reasentados. Cree encuestas con IA o desde un documento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const accesoRef = useRef<HTMLElement>(null);
  const logoStyle = { "--logo": `url("${logo.url}")` } as CSSProperties;

  const showAuth = (m: AuthMode) => {
    setAuthMode(m);
    accesoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => accesoRef.current?.querySelector<HTMLInputElement>("form input")?.focus({ preventScroll: true }), 350);
  };

  const openCreator = () => {
    if (!user) {
      toast("Primero cree su cuenta o inicie sesión.");
      showAuth("register");
      return;
    }
    setCreatorOpen(true);
    setTimeout(() => document.getElementById("documento")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  return (
    <div className="encuesta" style={logoStyle}>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <div className="wrap bar">
          <a className="brand" href="#top">
            <span className="mark" role="img" aria-label="Logo UNGRD" />
            <span>Seguimiento a<br />comunidades reasentadas</span>
          </a>
          <nav className="site-nav" aria-label="Principal">
            <a href="#mide">Qué mide</a>
            <a href="#ruta">Territorio</a>
            <a href="#pasos">Cómo funciona</a>
            <a
              className="btn gold"
              href="#acceso"
              onClick={() => {
                if (!user) setAuthMode("register");
              }}
            >
              {user ? "Mi cuenta" : "Registrarse"}
            </a>
          </nav>
        </div>
      </header>
      <main id="contenido">
        <div className="hero" id="top">
          <div className="wrap">
            <div>
              <h1>Saber cómo viven hoy las familias que el sismo dejó sin casa</h1>
              <p className="lead">
                Una herramienta de campo para registrar, medir y reportar la situación de los hogares reasentados de Paratebueno, Medina, Cabuyaro y Barranca de Upía.
              </p>
              <div className="cta">
                <button className="btn ghost" type="button" onClick={openCreator}>Crear una encuesta propia</button>
              </div>
            </div>
            <aside className="auth" id="acceso" aria-label="Cuenta" ref={accesoRef}>
              <Emblem />
              <AuthBox
                mode={authMode}
                setMode={setAuthMode}
                onOpenCreator={openCreator}
                onSignedOut={() => setCreatorOpen(false)}
              />
            </aside>
          </div>
        </div>
        <Facts />
        <Mide />
        <Ruta />
        <Pasos />
        {creatorOpen && user && (
          <Creator
            logoStyle={logoStyle}
            onClose={() => {
              setCreatorOpen(false);
              accesoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        )}
        <Herramientas onCreate={openCreator} />
      </main>
      <SiteFooter />
    </div>
  );
}
