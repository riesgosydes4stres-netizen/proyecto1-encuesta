import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/ungrd-logo.jpg.asset.json";

export const logoStyle = { "--logo": `url("${logo.url}")` } as CSSProperties;

export function PageShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="encuesta" style={logoStyle}>
      <header className="site-header">
        <div className="wrap bar">
          <Link className="brand" to="/">
            <span className="mark" role="img" aria-label="Logo UNGRD" />
            <span>Seguimiento a<br />comunidades reasentadas</span>
          </Link>
          <nav className="site-nav" aria-label="Principal">{right}</nav>
        </div>
      </header>
      <main id="contenido" className="page-main">
        <div className="wrap">{children}</div>
      </main>
      <footer className="page-foot">
        <div className="wrap">UNGRD · Unidad Nacional para la Gestión del Riesgo de Desastres · Seguimiento a comunidades reasentadas</div>
      </footer>
    </div>
  );
}
