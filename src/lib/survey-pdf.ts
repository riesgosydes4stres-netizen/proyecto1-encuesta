/**
 * Printable questionnaire (PDF) of a survey, built with pdf-lib standard fonts.
 * Pure JS (no DOM) so it can run in the browser or on the server.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { Question, SurveyDoc } from "./survey-parser";
import { pdfSafe, wrap } from "./report-pdf";

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  navy: hex("#0c2544"),
  gold: hex("#f2b705"),
  blue: hex("#2f5bea"),
  red: hex("#d62839"),
  ink: hex("#1d2939"),
  mute: hex("#5b6475"),
  line: hex("#c9d0dd"),
  paper: hex("#f4f6fb"),
  white: rgb(1, 1, 1),
};
const W = 595.28;
const H = 841.89;
const M = 44;
const CW = W - 2 * M;

export interface SurveyPdfInput {
  doc: SurveyDoc;
  link?: string | undefined;
  logo?: Uint8Array | null;
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  f: PDFFont;
  b: PDFFont;
}

const t = (ctx: Ctx, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = C.ink) =>
  ctx.page.drawText(pdfSafe(s), { x, y, size, font, color });

function newPage(ctx: Ctx, title: string) {
  ctx.page = ctx.pdf.addPage([W, H]);
  ctx.page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: C.navy });
  ctx.page.drawRectangle({ x: 0, y: H - 33, width: W, height: 3, color: C.gold });
  const head = wrap(title, ctx.b, 9, CW)[0] ?? "";
  t(ctx, head, M, H - 20, 9, ctx.b, C.white);
  ctx.y = H - 58;
}

function ensure(ctx: Ctx, need: number, title: string) {
  if (ctx.y - need < 56) newPage(ctx, title);
}

function paragraph(ctx: Ctx, s: string, x: number, size: number, font: PDFFont, color: RGB, max: number, lead = size + 3) {
  for (const l of wrap(s, font, size, max)) {
    t(ctx, l, x, ctx.y - size, size, font, color);
    ctx.y -= lead;
  }
}

function splitHelp(s: string): [string, string] {
  const m = s.match(/\s*\(([^()]{3,})\)\s*$/);
  return m ? [s.replace(m[0], "").trim(), m[1] ?? ""] : [s, ""];
}

/** Height a question's answer area needs (used to keep a question on one page). */
function answerHeight(ctx: Ctx, q: Question): number {
  switch (q.type) {
    case "long":
      return 66;
    case "single":
    case "select":
    case "multi": {
      const cols = q.opts.every((o) => ctx.f.widthOfTextAtSize(pdfSafe(o), 9.5) < CW / 2 - 40) ? 2 : 1;
      return Math.ceil(Math.max(1, q.opts.length) / cols) * 16 + 4;
    }
    case "scale":
      return 40;
    case "grid":
      return 20 + (q.rows?.length ?? 0) * 18 + 6;
    case "photo":
      return 136;
    case "signature":
      return 90;
    default:
      return 26;
  }
}

function drawAnswer(ctx: Ctx, q: Question) {
  const x = M + 18;
  const w = CW - 18;
  const p = ctx.page;
  if (q.type === "long") {
    for (let i = 0; i < 3; i++) {
      ctx.y -= 20;
      p.drawLine({ start: { x, y: ctx.y }, end: { x: x + w, y: ctx.y }, thickness: 0.7, color: C.line });
    }
    ctx.y -= 6;
  } else if (q.type === "single" || q.type === "select" || q.type === "multi") {
    const cols = q.opts.every((o) => ctx.f.widthOfTextAtSize(pdfSafe(o), 9.5) < CW / 2 - 40) ? 2 : 1;
    const colW = w / cols;
    const opts = q.opts.length ? q.opts : [""];
    opts.forEach((o, i) => {
      const cx = x + (i % cols) * colW;
      const cy = ctx.y - Math.floor(i / cols) * 16 - 10;
      if (q.type === "multi") p.drawRectangle({ x: cx, y: cy - 3, width: 9, height: 9, borderColor: C.navy, borderWidth: 0.9 });
      else p.drawEllipse({ x: cx + 4.5, y: cy + 1.5, xScale: 4.6, yScale: 4.6, borderColor: C.navy, borderWidth: 0.9 });
      const label = wrap(o, ctx.f, 9.5, colW - 22)[0] ?? "";
      t(ctx, label, cx + 15, cy - 2, 9.5, ctx.f);
    });
    ctx.y -= Math.ceil(opts.length / cols) * 16 + 4;
  } else if (q.type === "scale") {
    for (let v = 1; v <= 5; v++) {
      const bx = x + (v - 1) * 46;
      p.drawRectangle({ x: bx, y: ctx.y - 26, width: 34, height: 22, borderColor: C.navy, borderWidth: 0.9 });
      t(ctx, String(v), bx + 14, ctx.y - 19, 10, ctx.b, C.navy);
    }
    t(ctx, "1 = más bajo · 5 = más alto", x + 5 * 46 + 6, ctx.y - 19, 8.5, ctx.f, C.mute);
    ctx.y -= 40;
  } else if (q.type === "grid") {
    const rows = q.rows ?? [];
    const cols = q.cols ?? [];
    const labelW = Math.min(200, w * 0.4);
    const cw = cols.length ? (w - labelW) / cols.length : 0;
    p.drawRectangle({ x, y: ctx.y - 18, width: w, height: 18, color: C.paper });
    cols.forEach((c, j) => {
      const s = wrap(c, ctx.b, 7.5, cw - 4)[0] ?? "";
      t(ctx, s, x + labelW + j * cw + (cw - ctx.b.widthOfTextAtSize(s, 7.5)) / 2, ctx.y - 12, 7.5, ctx.b, C.navy);
    });
    ctx.y -= 18;
    rows.forEach((r) => {
      t(ctx, wrap(r, ctx.f, 9, labelW - 8)[0] ?? "", x + 4, ctx.y - 12, 9, ctx.f);
      cols.forEach((_, j) => {
        p.drawEllipse({ x: x + labelW + j * cw + cw / 2, y: ctx.y - 9, xScale: 4.4, yScale: 4.4, borderColor: C.navy, borderWidth: 0.8 });
      });
      ctx.y -= 18;
      p.drawLine({ start: { x, y: ctx.y }, end: { x: x + w, y: ctx.y }, thickness: 0.5, color: C.line });
    });
    ctx.y -= 6;
  } else if (q.type === "photo") {
    p.drawRectangle({ x, y: ctx.y - 130, width: 110, height: 126, borderColor: C.line, borderWidth: 1, borderDashArray: [4, 3] });
    t(ctx, "Foto", x + 42, ctx.y - 70, 10, ctx.f, C.mute);
    t(ctx, "Tómela con autorización de la persona encuestada.", x + 124, ctx.y - 20, 8.5, ctx.f, C.mute);
    ctx.y -= 136;
  } else if (q.type === "signature") {
    p.drawRectangle({ x, y: ctx.y - 80, width: 280, height: 76, borderColor: C.line, borderWidth: 1 });
    p.drawLine({ start: { x: x + 16, y: ctx.y - 60 }, end: { x: x + 264, y: ctx.y - 60 }, thickness: 0.7, color: C.mute });
    t(ctx, "Firma", x + 16, ctx.y - 72, 8, ctx.f, C.mute);
    ctx.y -= 90;
  } else {
    const bw = q.type === "date" || q.type === "number" ? 180 : w;
    p.drawRectangle({ x, y: ctx.y - 22, width: bw, height: 20, borderColor: C.line, borderWidth: 0.9 });
    if (q.type === "date") t(ctx, "DD / MM / AAAA", x + 8, ctx.y - 15, 8.5, ctx.f, C.mute);
    ctx.y -= 26;
  }
}

export async function buildSurveyPdf({ doc, link, logo }: SurveyPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = doc.title.trim() || "Encuesta sin título";
  pdf.setTitle(pdfSafe(title));
  pdf.setAuthor("UNGRD");
  pdf.setSubject("Formulario de encuesta");
  const ctx: Ctx = { pdf, page: pdf.addPage([W, H]), y: H, f, b };
  const visible = doc.questions.filter((q) => q.text.trim());

  // Cover band
  ctx.page.drawRectangle({ x: 0, y: H - 104, width: W, height: 104, color: C.navy });
  ctx.page.drawRectangle({ x: 0, y: H - 108, width: W, height: 4, color: C.gold });
  let img: PDFImage | null = null;
  if (logo) {
    try {
      img = await pdf.embedJpg(logo);
    } catch {
      try {
        img = await pdf.embedPng(logo);
      } catch {
        img = null;
      }
    }
  }
  let tx = M;
  if (img) {
    const s = 60 / img.height;
    ctx.page.drawRectangle({ x: M - 4, y: H - 86, width: img.width * s + 8, height: 68, color: C.white });
    ctx.page.drawImage(img, { x: M, y: H - 82, width: img.width * s, height: 60 });
    tx = M + img.width * s + 20;
  }
  t(ctx, "UNGRD · Gestión social y productiva", tx, H - 44, 10, b, C.gold);
  t(ctx, "para familia en reasentamiento", tx, H - 58, 10, b, C.gold);
  t(ctx, "Formulario de encuesta", tx, H - 78, 9, f, C.white);
  ctx.y = H - 136;

  paragraph(ctx, title, M, 19, b, C.navy, CW, 23);
  if (doc.desc?.trim()) {
    ctx.y -= 2;
    paragraph(ctx, doc.desc.trim(), M, 10, f, C.mute, CW, 14);
  }
  ctx.y -= 8;

  // Meta strip
  const req = visible.filter((q) => q.req).length;
  const date = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota" });
  ctx.page.drawRectangle({ x: M, y: ctx.y - 40, width: CW, height: 40, color: C.paper });
  const cells: [string, string][] = [
    ["Preguntas", String(visible.length)],
    ["Obligatorias", String(req)],
    ["Fecha de impresión", date],
  ];
  cells.forEach(([k, v], i) => {
    const cx = M + 14 + i * (CW / 3);
    t(ctx, k.toUpperCase(), cx, ctx.y - 14, 7, b, C.mute);
    t(ctx, v, cx, ctx.y - 30, 11, b, C.navy);
  });
  ctx.y -= 52;
  if (link) {
    t(ctx, "Responder en línea:", M, ctx.y - 10, 9, b, C.navy);
    t(ctx, wrap(link, f, 9, CW - 100)[0] ?? "", M + 92, ctx.y - 10, 9, f, C.blue);
    ctx.y -= 20;
  }
  // Fill-in header for field use
  const fx: [string, number][] = [["Fecha de aplicación", 0], ["Encuestador(a)", CW / 2]];
  fx.forEach(([k, off]) => {
    t(ctx, k, M + off, ctx.y - 12, 8.5, f, C.mute);
    ctx.page.drawLine({ start: { x: M + off + 92, y: ctx.y - 13 }, end: { x: M + off + CW / 2 - 14, y: ctx.y - 13 }, thickness: 0.7, color: C.line });
  });
  ctx.y -= 30;

  let sec = "";
  let n = 0;
  for (const q of visible) {
    if (q.sec && q.sec !== sec) {
      sec = q.sec;
      ensure(ctx, 70, title);
      ctx.y -= 6;
      ctx.page.drawRectangle({ x: M, y: ctx.y - 22, width: CW, height: 22, color: C.navy });
      ctx.page.drawRectangle({ x: M, y: ctx.y - 22, width: 4, height: 22, color: C.gold });
      t(ctx, wrap(sec, b, 10.5, CW - 24)[0] ?? "", M + 12, ctx.y - 15, 10.5, b, C.white);
      ctx.y -= 32;
    }
    n++;
    const [text, help] = splitHelp(q.text);
    const lines = wrap(text, b, 10.5, CW - 26);
    const need = lines.length * 14 + (help ? 12 : 0) + answerHeight(ctx, q) + 14;
    ensure(ctx, need, title);
    t(ctx, `${n}.`, M, ctx.y - 10.5, 10.5, b, C.navy);
    lines.forEach((l, i) => {
      t(ctx, l, M + 18, ctx.y - 10.5, 10.5, b, C.ink);
      if (q.req && i === lines.length - 1) t(ctx, "*", M + 18 + b.widthOfTextAtSize(pdfSafe(l), 10.5) + 3, ctx.y - 10.5, 10.5, b, C.red);
      ctx.y -= 14;
    });
    const hint = help || (q.type === "multi" ? "Marque todas las que apliquen." : q.type === "grid" ? "Marque una opción en cada fila." : "");
    if (hint) {
      t(ctx, wrap(hint, f, 8.5, CW - 18)[0] ?? "", M + 18, ctx.y - 8.5, 8.5, f, C.mute);
      ctx.y -= 12;
    }
    ctx.y -= 4;
    drawAnswer(ctx, q);
    ctx.y -= 10;
  }

  // Footers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: C.line });
    p.drawText(pdfSafe("* Pregunta obligatoria · Los datos recogidos son confidenciales y de uso exclusivo de la UNGRD."), { x: M, y: 27, size: 7.5, font: f, color: C.mute });
    const pn = pdfSafe(`Página ${i + 1} de ${pages.length}`);
    p.drawText(pn, { x: W - M - f.widthOfTextAtSize(pn, 7.5), y: 27, size: 7.5, font: f, color: C.mute });
  });
  return pdf.save();
}

export function surveyFileName(title: string): string {
  const slug = (title || "encuesta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = slug || "sin-titulo";
  return `${base.startsWith("encuesta") ? base : "encuesta-" + base}.pdf`;
}
