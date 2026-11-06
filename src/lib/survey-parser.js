/*
 * Survey text parser ported verbatim (logic-wise) from the original
 * Encuesta Studio index.html. Kept as plain JS so the heuristics stay
 * byte-for-byte comparable with the source; types live in survey-parser.d.ts.
 */

export const TIPOS = {
  short: "Respuesta corta",
  date: "Fecha",
  number: "Número",
  grid: "Cuadrícula (filas y columnas)",
  select: "Lista desplegable",
  long: "Párrafo",
  single: "Opción única",
  multi: "Opción múltiple",
  scale: "Escala 1 a 5",
};

export const uid = () => "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function parse(text, fname) {
  const L = text.replace(/\r/g, "").split("\n").map((s) => s.trim()).filter(Boolean),
    S = { title: "", desc: "", questions: [] };
  let cur = null,
    curSec = "";
  const optRe = /^(?:[-–•*·▪○☐□]|\(?[a-zA-Z]\)|[a-zA-Z][.)]|\[\s?\])\s+(.+)$/,
    numRe = /^(?:pregunta\s+)?\d+\s*[.)\-:]\s+/i;
  const BOX = /\(\s*\)|\[\s*\]|☐|□/g,
    isInline = (o) => (o.match(BOX) || []).length >= 2,
    splitInline = (o) =>
      o
        .split(BOX)
        .map((x) => x.replace(/^[\s,;:·\-–]+|[\s,;:·\-–]+$/g, ""))
        .filter(Boolean);
  const NUM = /\b(?:n[uú]mero|cantidad|total)\s+de\b|^(?:n[°º]|nro\.?|no\.)\s|cu[aá]nt[oa]s?\b|^edad\b/i,
    NONUM = /documento|c[eé]dula|identidad|tel[eé]fono|celular|contacto|ficha|matr[ií]cula|placa|lote|manzana|predio|casa|apartamento/i;
  const FIELD =
    /^(fecha|nombre|documento|c[eé]dula|identidad|municipio|ubicaci[oó]n|direcci[oó]n|tel[eé]fono|celular|correo|edad|barrio|vereda|estado|ocupaci[oó]n|profesi[oó]n|n[uú]mero|sexo|g[eé]nero)\b/i;
  const fin1 = (q) => {
    if (!q) return;
    if (/municipio|territorio/i.test(q.text)) q.opts = q.opts.map((o) => (/^yopal$/i.test(o) ? "Yopal (Casanare)" : o));
    if (q.tbl && q.tbl.length >= 2) {
      const h = q.tbl[0],
        rs = q.tbl.slice(1),
        nc = Math.max(...rs.map((r) => r.length));
      const dj =
        !h[0] ||
        /^(servicios?|concepto|detalle|criterio|[ií]tems?|aspecto)s?$/i.test(h[0]) ||
        (nc > 1 && h.length === nc);
      q.cols = (dj ? h.slice(1) : h).filter(Boolean);
      q.rows = rs.map((r) => r[0] || "").filter(Boolean);
    }
    if (q.cols && q.cols.length && q.rows && q.rows.length) q.type = "grid";
    if (q.type === "grid" && !(q.cols && q.cols.length && q.rows && q.rows.length)) {
      q.rows = ["Fila 1", "Fila 2"];
      q.cols = ["Sí", "No"];
      q.auto = true;
    }
    if (!q.opts.length) {
      const x = q.text;
      if (/(municipio|territorio).*reasentamiento/i.test(x)) q.opts = ["Meta", "Yopal (Casanare)"];
      else if (/municipio.*(origen|afectad)/i.test(x)) q.opts = ["Paratebueno", "Medina", "Cabuyaro", "Barranca de Upía"];
    }
    if (!q.type) {
      q.type = /^fecha\b/i.test(q.text)
        ? "date"
        : /ubicaci[oó]n|direcci[oó]n|nombre completo|c[eé]dula|n[uú]mero de documento|documento de identidad/i.test(q.text) &&
            !/\btipo\b/i.test(q.text)
          ? "short"
          : /estado (actual )?(de (la )?)?vivienda/i.test(q.text)
            ? "multi"
            : !q.opts.length && NUM.test(q.text) && !NONUM.test(q.text)
              ? "number"
              : q.opts.length && /municipio|departamento|ciudad/i.test(q.text)
                ? "select"
                : q.opts.length
                  ? "single"
                  : /describa|explique|comente|cuéntenos|cuentenos|observaci|sugerencia|por qué|por que/i.test(q.text)
                    ? "long"
                    : "short";
    }
    if (q.type === "scale" || q.type === "short" || q.type === "long" || q.type === "date" || q.type === "number" || q.type === "grid")
      q.opts = [];
    else if (!q.opts.length) {
      q.opts = ["Opción 1", "Opción 2"];
      q.auto = true;
    }
    delete q.tbl;
    S.questions.push(q);
  };
  /* «1. Datos del titular:» seguido de campos (Fecha, Nombre…) = una sección con una pregunta por campo */
  const fin = (q) => {
    if (!q) return;
    const raw = q.opts,
      grupo = /:\s*$/.test(q.text) && raw.filter((o) => FIELD.test(o)).length >= 2;
    if (!grupo) {
      q.opts = raw.flatMap((o) => (isInline(o) ? splitInline(o) : [o]));
      if (raw.some(isInline) && !q.type) q.type = "multi";
      fin1(q);
      return;
    }
    const sec = q.text.replace(/\s*:\s*$/, "");
    let prev = null;
    raw.forEach((o) => {
      if (isInline(o)) {
        if (prev) {
          prev.opts = splitInline(o);
          if (!prev.type) prev.type = "multi";
        }
        return;
      }
      let t = o.replace(/\s*:\s*$/, "").trim(),
        opts = [];
      const m = t.match(/\(([^()]*\s\/\s[^()]*)\)\s*$/);
      if (m) {
        opts = m[1].split(/\s\/\s/).map((x) => x.trim()).filter(Boolean);
        t = t.replace(m[0], "").trim();
      }
      fin1(prev);
      prev = { id: uid(), type: "", text: t, req: true, sec, opts };
    });
    fin1(prev);
  };
  L.forEach((line, ix) => {
    let m;
    if ((m = line.match(/^t[ií]tulo\s*:\s*(.+)/i))) {
      S.title = m[1];
      return;
    }
    if ((m = line.match(/^descripci[oó]n\s*:\s*(.+)/i))) {
      S.desc = m[1];
      return;
    }
    if ((m = line.match(/^(?:secci[oó]n|parte|m[oó]dulo|cap[ií]tulo)\s*[\dIVXivx]*\s*[:.\-–—]\s*(.+)$/i))) {
      fin(cur);
      cur = null;
      curSec = m[1].trim();
      return;
    }
    if (cur && (m = line.match(/^(columnas?|filas?)\s*:\s*(.+)$/i))) {
      const a = m[2].split(/\s*[|;]\s*/).map((x) => x.trim()).filter(Boolean);
      if (/^c/i.test(m[1])) cur.cols = a;
      else cur.rows = a;
      return;
    }
    if (cur && (line.split("\t").length > 2 || (line.match(/\|/g) || []).length >= 2)) {
      (cur.tbl = cur.tbl || []).push(line.split(/\t|\|/).map((x) => x.trim()));
      return;
    }
    if (cur && cur.tbl && !numRe.test(line) && !/^¿/.test(line) && !/\?\s*\*?\s*$/.test(line) && !optRe.test(line)) {
      cur.tbl.push([line]);
      return;
    }
    {
      const nx = L[ix + 1];
      if (
        S.title &&
        nx &&
        numRe.test(nx) &&
        !numRe.test(line) &&
        !/^¿/.test(line) &&
        !/\?\s*\*?\s*$/.test(line) &&
        !(cur && optRe.test(line)) &&
        !(cur && cur.tbl) &&
        line.length <= 90 &&
        !/[.:;,]$/.test(line) &&
        (!cur || !cur.opts.length || /^[A-ZÁÉÍÓÚÑ0-9\s\-–:]{6,}$/.test(line))
      ) {
        fin(cur);
        cur = null;
        curSec = line;
        return;
      }
    }
    let lead = false;
    if (/^\*\s*(?:pregunta\s+)?\d+\s*[.)\-:]/i.test(line)) {
      line = line.replace(/^\*\s*/, "");
      lead = true;
    }
    const isOpt = cur && optRe.test(line) && !numRe.test(line),
      isQ = numRe.test(line) || /^¿/.test(line) || /\?\s*\*?\s*$/.test(line);
    if (isOpt) {
      cur.opts.push(isInline(line) ? line : line.match(optRe)[1].trim());
      return;
    }
    if (isQ) {
      fin(cur);
      let t = line.replace(numRe, "").trim(),
        type = "",
        req = lead;
      if (/\*\s*$/.test(t)) {
        req = true;
        t = t.replace(/\s*\*\s*$/, "");
      }
      t = t
        .replace(/\((obligatoria|requerida)\)/i, () => {
          req = true;
          return "";
        })
        .replace(/\((varias?[^)]*|m[uú]ltiple[^)]*|selecci[oó]n m[uú]ltiple|marque todas[^)]*)\)/i, () => {
          type = "multi";
          return "";
        })
        .replace(/\((escala[^)]*|del 1 al 5)\)/i, () => {
          type = "scale";
          return "";
        })
        .replace(/\((p[aá]rrafo|respuesta larga|abierta)\)/i, () => {
          type = "long";
          return "";
        })
        .replace(/\((corta|respuesta corta)\)/i, () => {
          type = "short";
          return "";
        })
        .replace(/\((fecha)\)/i, () => {
          type = "date";
          return "";
        })
        .replace(/\((n[uú]mero|num[eé]rica?)\)/i, () => {
          type = "number";
          return "";
        })
        .replace(/\((matriz|cuadr[ií]cula|tabla)\)/i, () => {
          type = "grid";
          return "";
        })
        .replace(/\((desplegable|lista|lista desplegable)\)/i, () => {
          type = "select";
          return "";
        })
        .trim();
      if (!type && /seleccione todas|marque todas|varias opciones/i.test(t)) type = "multi";
      cur = { id: uid(), type, text: t, req, sec: curSec, opts: [] };
      return;
    }
    if (cur) {
      cur.opts.push(line);
      return;
    }
    if (!S.title) S.title = line;
    else S.desc += (S.desc ? " " : "") + line;
  });
  fin(cur);
  if (!S.title) S.title = fname || "Encuesta sin título";
  return S;
}

/* Word -> texto: conserva la numeración automática de Word, los títulos y las viñetas */
export function htmlATexto(html) {
  const d = new DOMParser().parseFromString(html, "text/html"),
    out = [];
  let n = 0;
  d.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  const lin = (e) =>
      e.textContent
        .split("\n")
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    txt = (e) => lin(e).join(" ");
  const propio = (li) => {
    const c = li.cloneNode(true);
    c.querySelectorAll("ol,ul").forEach((x) => x.remove());
    return lin(c);
  };
  function lista(l, dep) {
    for (const li of l.children) {
      if (li.tagName !== "LI") continue;
      const xs = propio(li);
      if (xs.length) {
        if (dep === 0 && l.tagName === "OL") {
          n++;
          out.push(n + ". " + xs[0]);
        } else out.push("- " + xs[0]);
        xs.slice(1).forEach((y) => out.push("- " + y));
      }
      li.querySelectorAll(":scope > ol, :scope > ul").forEach((m) => lista(m, dep + 1));
    }
  }
  function walk(el) {
    for (const c of el.children) {
      const t = c.tagName;
      if (/^H[1-6]$/.test(t)) {
        const x = txt(c);
        if (x) out.push(out.length ? "Sección: " + x : x);
      } else if (t === "OL" || t === "UL") lista(c, 0);
      else if (t === "TABLE") {
        c.querySelectorAll("tr").forEach((r) => {
          const cs = [...r.children].map(txt);
          if (cs.some(Boolean)) out.push(cs.join(" | "));
        });
      } else if (t === "P") {
        const L2 = lin(c),
          bd = [...c.querySelectorAll("strong,b")]
            .map((e) => e.textContent)
            .join("")
            .replace(/\s+/g, "");
        if (
          out.length &&
          L2.length === 1 &&
          bd &&
          bd === L2[0].replace(/\s+/g, "") &&
          L2[0].length >= 8 &&
          /\s/.test(L2[0]) &&
          !/^\d/.test(L2[0]) &&
          !/[?:.]\s*$/.test(L2[0])
        )
          out.push("Sección: " + L2[0]);
        else L2.forEach((x) => out.push(x));
      } else walk(c);
    }
  }
  walk(d.body);
  return out.join("\n");
}

export const IA_REGLAS =
  "Escribe una encuesta en español usando EXACTAMENTE este formato de texto plano, sin Markdown, sin comentarios y sin texto adicional antes o después:\n- La primera línea es el título.\n- Segunda línea: «Descripción: …» con una frase breve.\n- Agrupa las preguntas en secciones con una línea «Sección: Nombre» antes de cada grupo.\n- Cada pregunta va en su línea, numerada («1.») con numeración continua.\n- Las opciones van debajo, una por línea, con guion: «- Opción».\n- Sin opciones, la pregunta es de respuesta corta.\n- Al final de la pregunta puede añadir (varias) para selección múltiple, (escala) para escala del 1 al 5, (párrafo) para respuesta larga, (fecha) para un campo de fecha con calendario, (matriz) para una tabla de filas y columnas, seguida de las líneas «Filas: a | b | c» y «Columnas: x | y | z», (número) para respuestas numéricas como cantidad de miembros o edad, (desplegable) para una lista desplegable, o * si es obligatoria. Usa (desplegable) en municipios y ciudades; nombres, números de documento y direcciones van sin opciones.\n- Las preguntas de opción única o múltiple llevan entre 3 y 6 opciones.\nEjemplo:\nEncuesta de satisfacción del servicio\nDescripción: Ayúdenos a mejorar la atención a las familias.\nSección: Datos del hogar\n1. Fecha de la entrevista (fecha) *\nSección: Servicios\n2. ¿Cómo califica la atención recibida? (escala)\n3. ¿Qué servicios utilizó? (varias)\n- Agua\n- Energía\n- Salud\n4. ¿Cuál es su municipio? *\n- Paratebueno\n- Medina\n5. Cuéntenos qué debemos mejorar (párrafo)";

/** Builds the AI request text exactly like the original iaPedido(). */
export function iaPedido(tema, doc) {
  const t = (tema || "").trim();
  if (!t && !doc) return "";
  const p = doc
    ? "Convierte el siguiente documento en una encuesta. Conserva sus preguntas y opciones y mejora la redacción solo si hace falta." +
      (t ? " Indicaciones adicionales: " + t : "") +
      "\n\nDOCUMENTO:\n" +
      doc.slice(0, 30000) +
      "\n\n"
    : "Necesito esta encuesta: " + t + "\n\n";
  return p + IA_REGLAS;
}

export const EJEMPLO = `Encuesta de satisfacción del servicio
Descripción: Ayúdenos a mejorar la atención a las familias.
Sección: Datos del hogar
1. Fecha de la entrevista (fecha) *
2. ¿Cuál es su municipio? *
a) Paratebueno
b) Medina
Sección: Servicios
3. ¿Cómo califica la atención recibida? (escala)
4. ¿Qué servicios utilizó? (varias)
- Agua
- Energía
- Salud
5. Cuéntenos qué debemos mejorar (párrafo)`;

export function slugify(title) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "encuesta"
  );
}
