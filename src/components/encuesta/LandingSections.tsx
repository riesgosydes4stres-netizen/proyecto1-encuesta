import footerImg from "@/assets/ungrd-brigadistas.jpg.asset.json";

export function Facts() {
  return (
    <div className="facts">
      <div className="wrap">
        <ul>
          <li><b>4</b>municipios de origen en Cundinamarca y Meta</li>
          <li><b>2</b>destinos de reasentamiento: Meta y Yopal</li>
          <li><b>6</b>secciones, de la vivienda a la salud</li>
          <li><b>PDF</b>informes y gráficas listos para entregar</li>
        </ul>
      </div>
    </div>
  );
}

export function Mide() {
  return (
    <section id="mide">
      <div className="wrap split">
        <div>
          <p className="lbl">Qué mide</p>
          <h2>Seis frentes de la vida de un hogar</h2>
          <p>Cada encuesta recorre las mismas secciones, para que los datos de un municipio se puedan comparar con los de otro y con los de los meses siguientes.</p>
        </div>
        <ul className="rows">
          <li>
            <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" /></svg>
            <div><h3>El hogar y su vivienda</h3><p>Quién es el titular, de dónde viene y en qué estado quedó su casa.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 5.5 2 5.5 5.5" /></svg>
            <div><h3>Composición familiar</h3><p>Integrantes por edad, discapacidad, pertenencia étnica y jefatura femenina.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path d="M12 3C8 8 6 11 6 14a6 6 0 0 0 12 0c0-3-2-6-6-11z" /></svg>
            <div><h3>Servicios y convivencia</h3><p>Agua, energía, gas e internet, y cómo se siente la familia en su nuevo barrio.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8V5h6v3M3 13h18" /></svg>
            <div><h3>Medios de vida</h3><p>De qué vivían antes, de qué viven ahora y qué formación necesitan para sostenerse.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
            <div><h3>Seguridad y salud</h3><p>Afectaciones físicas o emocionales, protección laboral y riesgos del entorno.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>
            <div><h3>Lo que piden las familias</h3><p>Las dos acciones que cada hogar le solicita a su alcaldía.</p></div>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function Ruta() {
  return (
    <section className="ruta" id="ruta">
      <div className="wrap">
        <p className="lbl">Territorio</p>
        <h2>De dónde vienen y adónde llegaron</h2>
        <div className="route">
          <div className="col">
            <h3>Municipios afectados</h3>
            <div className="node">Paratebueno<small>Cundinamarca</small></div>
            <div className="node">Medina<small>Cundinamarca</small></div>
            <div className="node">Cabuyaro<small>Meta</small></div>
            <div className="node">Barranca de Upía<small>Meta</small></div>
          </div>
          <div className="link" aria-hidden="true" />
          <div className="col to">
            <h3>Reasentamiento</h3>
            <div className="node">Meta<small>Departamento</small></div>
            <div className="node">Yopal<small>Casanare</small></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Pasos() {
  return (
    <section id="pasos">
      <div className="wrap">
        <p className="lbl">Cómo funciona</p>
        <h2>De la visita al informe en cuatro pasos</h2>
        <ol className="steps">
          <li><h3>Registre el hogar</h3><p>Nombre, documento y municipio de origen y de reasentamiento.</p></li>
          <li><h3>Responda por secciones</h3><p>Una página por tema, con preguntas que aparecen solo cuando aplican.</p></li>
          <li><h3>Vea las gráficas</h3><p>Al enviar, la muestra de cada municipio se actualiza al instante.</p></li>
          <li><h3>Entregue el resultado</h3><p>Descargue el PDF, exporte el CSV o envíelo por correo.</p></li>
        </ol>
      </div>
    </section>
  );
}

export function Herramientas({ onCreate }: { onCreate: () => void }) {
  return (
    <section id="herramientas" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <h2>Elija por dónde empezar</h2>
        <div className="tools">
          <article className="tool t2">
            <h3>Creador de encuestas</h3>
            <p>Arme su propio formulario con preguntas de opción, párrafo o escala, y vea los resultados.</p>
            <button className="btn" type="button" onClick={onCreate}>Crear una encuesta</button>
          </article>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <img src={footerImg.url} alt="Logo de la UNGRD junto a una calle inundada donde trabajan brigadistas" width={900} height={576} loading="lazy" />
        <div>
          <h2>Unidad Nacional para la Gestión del Riesgo de Desastres</h2>
          <p>Esta herramienta acompaña el seguimiento a las comunidades afectadas por el sismo de 2025. Las encuestas que usted crea se guardan en su cuenta.</p>
          <small className="cr">Proyecto I · Gerencia de Proyectos</small>
        </div>
      </div>
    </footer>
  );
}
