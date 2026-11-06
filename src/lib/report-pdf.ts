/**
 * Professional household report (PDF) built with pdf-lib. Pure JS so it runs
 * in the browser (download) and on the server (email link) alike.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { Question } from "./survey-parser";
import {
  DIMENSIONS,
  LEVELS,
  answerText,
  canScore,
  compareIndex,
  computeIndex,
  dimLabel,
  fmt,
  isMediaType,
  levelOf,
  questionRisk,
  type Answers,
  type IndexResult,
} from "./vulnerability";

export interface ReportInput {
  title: string;
  desc?: string;
  questions: Question[];
  answers: Answers;
  media?: Record<string, string>;
  createdAt: string;
  householdCode?: string;
  responseId?: string;
  previous?: { createdAt: string; questions: Question[]; answers: Answers; surveyTitle?: string } | null;
  logo?: Uint8Array | null;
  /** Marks the report as a preview (nothing was saved). */
  preview?: boolean;
}

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  navy: hex("#0c2544"),
  navy2: hex("#1b3a66"),
  gold: hex("#f2b705"),
  blue: hex("#2f5bea"),
  red: hex("#d62839"),
  green: hex("#1f9d6b"),
  ink: hex("#1d2939"),
  mute: hex("#5b6475"),
  line: hex("#dfe3ec"),
  paper: hex("#f4f6fb"),
  white: rgb(1, 1, 1),
  soft: hex("#c9d3e6"),
  grey: hex("#a7b0c0"),
};

const W = 595.28;
const H = 841.89;
const M = 40;

/** Keeps only characters the standard (WinAnsi) fonts can draw. */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfSafe(s: string): string {
  return s
    .replace(/[\u2192\u279C\u27A1]/g, "->")
    .replace(/[\u2190]/g, "<-")
    .replace(/[\u2264]/g, "<=")
    .replace(/[\u2265]/g, ">=")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\r\t]/g, " ")
    .split("")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return ch === "\n" || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.includes(ch);
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w0 of words) {
      let w = w0;
      // Break very long words
      while (font.widthOfTextAtSize(w, size) > max) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > max) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const t = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > max) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

function b64ToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m?.[2]) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function embedDataUrl(doc: PDFDocument, dataUrl: string | undefined): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const bytes = b64ToBytes(dataUrl);
  if (!bytes) return null;
  try {
    return dataUrl.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function fmtDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }
    : { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota" };
  try {
    return d.toLocaleString("es-CO", opts);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  f: PDFFont;
  b: PDFFont;
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = C.ink) {
  ctx.page.drawText(pdfSafe(s), { x, y, size, font, color });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([W, H]);
  // slim header on continuation pages
  ctx.page.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: C.navy });
  ctx.page.drawRectangle({ x: 0, y: H - 37, width: W, height: 3, color: C.gold });
  text(ctx, "UNGRD · Informe de caracterización y vulnerabilidad", M, H - 22, 9, ctx.b, C.white);
  ctx.y = H - 60;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < 60) newPage(ctx);
}

function sectionTitle(ctx: Ctx, title: string, sub?: string) {
  ensure(ctx, 50);
  ctx.page.drawRectangle({ x: M, y: ctx.y - 16, width: 4, height: 18, color: C.gold });
  text(ctx, title, M + 12, ctx.y - 12, 13, ctx.b, C.navy);
  ctx.y -= 22;
  if (sub) {
    for (const l of wrap(sub, ctx.f, 8.5, W - 2 * M - 12)) {
      text(ctx, l, M + 12, ctx.y - 8, 8.5, ctx.f, C.mute);
      ctx.y -= 11;
    }
  }
  ctx.y -= 8;
}

/** Semicircle gauge (0–100) drawn with SVG arcs. cx/cy are PDF coordinates of the centre. */
function gauge(ctx: Ctx, cx: number, cy: number, r: number, value: number | null) {
  const segs = [
    [0, 25, LEVELS[0]!.hex],
    [25, 50, LEVELS[1]!.hex],
    [50, 75, LEVELS[2]!.hex],
    [75, 100, LEVELS[3]!.hex],
  ] as const;
  const pt = (v: number) => {
    const a = Math.PI - (v / 100) * Math.PI;
    return [r * Math.cos(a), -r * Math.sin(a)] as const;
  };
  for (const [a, b, col] of segs) {
    const [x1, y1] = pt(a + 0.6);
    const [x2, y2] = pt(b - 0.6);
    ctx.page.drawSvgPath(`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`, {
      x: cx,
      y: cy,
      borderColor: hex(col),
      borderWidth: 16,
      borderOpacity: value === null ? 0.35 : 1,
    });
  }
  // ticks labels
  for (const v of [0, 25, 50, 75, 100]) {
    const a = Math.PI - (v / 100) * Math.PI;
    const tx = cx + (r + 16) * Math.cos(a);
    const ty = cy + (r + 16) * Math.sin(a);
    const s = String(v);
    text(ctx, s, tx - ctx.f.widthOfTextAtSize(s, 7) / 2, ty - 2, 7, ctx.f, C.mute);
  }
  if (value !== null) {
    const a = Math.PI - (Math.min(100, Math.max(0, value)) / 100) * Math.PI;
    ctx.page.drawLine({
      start: { x: cx, y: cy },
      end: { x: cx + (r - 14) * Math.cos(a), y: cy + (r - 14) * Math.sin(a) },
      thickness: 3,
      color: C.navy,
    });
    ctx.page.drawCircle({ x: cx, y: cy, size: 6, color: C.navy });
    ctx.page.drawCircle({ x: cx, y: cy, size: 2.5, color: C.gold });
  }
}

function pill(ctx: Ctx, label: string, x: number, y: number, color: RGB, size = 8) {
  const s = pdfSafe(label);
  const w = ctx.b.widthOfTextAtSize(s, size) + 12;
  ctx.page.drawRectangle({ x, y: y - 4, width: w, height: size + 7, color, borderColor: color, borderWidth: 0 });
  text(ctx, s, x + 6, y, size, ctx.b, C.white);
  return w;
}

function dimBars(ctx: Ctx, x: number, top: number, width: number, idx: IndexResult) {
  let y = top;
  for (const d of DIMENSIONS) {
    const v = idx.dims[d.key];
    text(ctx, d.label, x, y - 10, 10, ctx.b, C.navy);
    text(ctx, d.long, x, y - 21, 7.5, ctx.f, C.mute);
    const val = v === null ? "Sin datos" : fmt(v);
    text(ctx, val, x + width - ctx.b.widthOfTextAtSize(val, 11), y - 11, 11, ctx.b, C.ink);
    const by = y - 34;
    ctx.page.drawRectangle({ x, y: by, width, height: 9, color: C.paper, borderColor: C.line, borderWidth: 0.5 });
    if (v !== null) {
      const lv = levelOf(v);
      ctx.page.drawRectangle({ x, y: by, width: Math.max(2, (width * v) / 100), height: 9, color: hex(lv.hex) });
      text(ctx, lv.label, x, by - 10, 7.5, ctx.b, hex(lv.hex));
    }
    y -= 56;
  }
}

function legend(ctx: Ctx, x: number, y: number) {
  let cx = x;
  const ranges = ["0–24,9", "25–49,9", "50–74,9", "75–100"];
  LEVELS.forEach((l, i) => {
    ctx.page.drawRectangle({ x: cx, y: y - 1, width: 9, height: 9, color: hex(l.hex) });
    const s = `${l.label} (${ranges[i]})`;
    text(ctx, s, cx + 13, y, 7.5, ctx.f, C.mute);
    cx += 13 + ctx.f.widthOfTextAtSize(pdfSafe(s), 7.5) + 14;
  });
}

export async function buildReportPdf(input: ReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Informe - ${input.title}`));
  doc.setAuthor("UNGRD - Seguimiento a comunidades reasentadas");
  doc.setSubject("Índice de Vulnerabilidad Territorial");
  doc.setCreator("Encuesta Studio");
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([W, H]);
  const ctx: Ctx = { doc, page, y: H, f, b };

  const visible = input.questions.filter((q) => q.text.trim());
  const idx = computeIndex(visible, input.answers);
  const prevIdx = input.previous ? computeIndex(input.previous.questions, input.previous.answers) : null;

  // ---------- Cover band ----------
  ctx.page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: C.navy });
  ctx.page.drawRectangle({ x: W - 210, y: H - 150, width: 210, height: 150, color: C.navy2, opacity: 0.6 });
  ctx.page.drawCircle({ x: W - 40, y: H - 20, size: 90, color: C.blue, opacity: 0.18 });
  ctx.page.drawRectangle({ x: 0, y: H - 156, width: W, height: 6, color: C.gold });
  let tx = M;
  if (input.logo) {
    try {
      const img = await doc.embedJpg(input.logo);
      ctx.page.drawCircle({ x: M + 32, y: H - 62, size: 35, color: C.white });
      ctx.page.drawImage(img, { x: M + 4, y: H - 90, width: 56, height: 56 });
      tx = M + 84;
    } catch {
      /* logo optional */
    }
  }
  text(ctx, "UNGRD · SEGUIMIENTO A COMUNIDADES REASENTADAS", tx, H - 40, 8, b, C.gold);
  text(ctx, "Informe de caracterización", tx, H - 64, 20, b, C.white);
  text(ctx, "y vulnerabilidad del hogar", tx, H - 86, 20, b, C.white);
  const tl = wrap(input.title, f, 10.5, W - tx - M);
  tl.slice(0, 2).forEach((l, i) => text(ctx, l, tx, H - 108 - i * 13, 10.5, f, C.soft));
  if (input.preview) pill(ctx, "VISTA PREVIA · SIN GUARDAR", W - M - 150, H - 40, C.red, 7.5);

  // ---------- Meta cards ----------
  const answered = visible.filter((q) => {
    const a = isMediaType(q) ? input.media?.[q.id] : input.answers[q.id];
    return a !== undefined && a !== "" && !(Array.isArray(a) && !a.length);
  }).length;
  const meta = [
    ["Fecha de registro", fmtDate(input.createdAt)],
    ["Código del hogar", input.householdCode ? input.householdCode.toUpperCase() : "No registrado"],
    ["Folio", input.responseId ? input.responseId.slice(0, 8).toUpperCase() : "—"],
    ["Preguntas respondidas", `${answered} de ${visible.length}`],
  ];
  const cw = (W - 2 * M - 3 * 10) / 4;
  meta.forEach(([k, v], i) => {
    const x = M + i * (cw + 10);
    ctx.page.drawRectangle({ x, y: H - 222, width: cw, height: 50, color: C.white, borderColor: C.line, borderWidth: 1 });
    ctx.page.drawRectangle({ x, y: H - 222, width: 3, height: 50, color: i === 0 ? C.gold : C.blue });
    text(ctx, k!.toUpperCase(), x + 10, H - 188, 6.5, b, C.mute);
    const vl = wrap(v!, b, 9.5, cw - 16);
    vl.slice(0, 2).forEach((l, j) => text(ctx, l, x + 10, H - 202 - j * 11, 9.5, b, C.ink));
  });
  ctx.y = H - 246;

  // ---------- Index ----------
  sectionTitle(
    ctx,
    "Índice de Vulnerabilidad Territorial (IVT)",
    "Construido con tres componentes de igual peso: Vivienda + Medios de vida + SST. Cada respuesta se califica de 0 (sin vulnerabilidad) a 100 (vulnerabilidad máxima).",
  );
  const boxTop = ctx.y;
  const boxH = 200;
  ctx.page.drawRectangle({ x: M, y: boxTop - boxH, width: W - 2 * M, height: boxH, color: C.paper, borderColor: C.line, borderWidth: 1 });
  const gx = M + 120;
  const gy = boxTop - 104;
  gauge(ctx, gx, gy, 78, idx.ivt);
  const big = idx.ivt === null ? "—" : fmt(idx.ivt);
  text(ctx, big, gx - b.widthOfTextAtSize(big, 30) / 2, gy - 36, 30, b, C.navy);
  if (idx.level) {
    const lbl = "Nivel " + idx.level.label.toLowerCase();
    const w = b.widthOfTextAtSize(pdfSafe(lbl), 9) + 12;
    pill(ctx, lbl, gx - w / 2, gy - 56, hex(idx.level.hex), 9);
  } else {
    const s = "Sin preguntas asignadas al índice";
    text(ctx, s, gx - f.widthOfTextAtSize(s, 8) / 2, gy - 54, 8, f, C.mute);
  }
  text(ctx, "IVT = (Vivienda + Medios de vida + SST) / 3", M + 28, boxTop - boxH + 12, 7.5, b, C.mute);
  dimBars(ctx, M + 262, boxTop - 14, W - 2 * M - 262 - 20, idx);
  ctx.y = boxTop - boxH - 12;
  legend(ctx, M, ctx.y);
  ctx.y -= 14;
  if (!idx.complete && idx.ivt !== null) {
    text(ctx, "Nota: algún componente no tiene respuestas; el IVT promedia solo los componentes disponibles.", M, ctx.y, 7.5, f, C.mute);
    ctx.y -= 12;
  }
  ctx.y -= 10;

  // ---------- Comparison ----------
  if (input.previous && prevIdx) {
    const rows = compareIndex(prevIdx, idx);
    sectionTitle(
      ctx,
      "Cruce con la medición anterior",
      `Comparación con el registro del ${fmtDate(input.previous.createdAt, false)}${input.previous.surveyTitle ? ` («${input.previous.surveyTitle}»)` : ""}. Una diferencia positiva indica que la vulnerabilidad aumentó.`,
    );
    ensure(ctx, 170);
    const top = ctx.y;
    const chartH = 120;
    const chartW = 300;
    const baseY = top - chartH - 10;
    ctx.page.drawLine({ start: { x: M, y: baseY }, end: { x: M + chartW, y: baseY }, thickness: 0.8, color: C.grey });
    for (const g of [25, 50, 75, 100]) {
      const gy2 = baseY + (g / 100) * chartH;
      ctx.page.drawLine({ start: { x: M, y: gy2 }, end: { x: M + chartW, y: gy2 }, thickness: 0.3, color: C.line });
      text(ctx, String(g), M - 14, gy2 - 2, 6.5, f, C.mute);
    }
    const slot = chartW / rows.length;
    rows.forEach((r, i) => {
      const x0 = M + i * slot + slot / 2 - 22;
      if (r.prev !== null) ctx.page.drawRectangle({ x: x0, y: baseY, width: 20, height: (r.prev / 100) * chartH, color: C.grey });
      if (r.cur !== null) ctx.page.drawRectangle({ x: x0 + 24, y: baseY, width: 20, height: (r.cur / 100) * chartH, color: hex(levelOf(r.cur).hex) });
      const lb = pdfSafe(r.label);
      text(ctx, lb, M + i * slot + slot / 2 - b.widthOfTextAtSize(lb, 7.5) / 2, baseY - 11, 7.5, b, C.ink);
    });
    ctx.page.drawRectangle({ x: M, y: baseY - 26, width: 9, height: 7, color: C.grey });
    text(ctx, "Anterior", M + 12, baseY - 25, 7, f, C.mute);
    ctx.page.drawRectangle({ x: M + 60, y: baseY - 26, width: 9, height: 7, color: C.blue });
    text(ctx, "Actual (color según nivel)", M + 72, baseY - 25, 7, f, C.mute);
    // table
    const tx0 = M + chartW + 24;
    const tw = W - M - tx0;
    const cols = [tx0, tx0 + tw * 0.42, tx0 + tw * 0.62, tx0 + tw * 0.82];
    ctx.page.drawRectangle({ x: tx0, y: top - 18, width: tw, height: 18, color: C.navy });
    ["Componente", "Antes", "Ahora", "Cambio"].forEach((h, i) => text(ctx, h, cols[i]! + 5, top - 12, 7.5, b, C.white));
    rows.forEach((r, i) => {
      const ry = top - 18 - (i + 1) * 20;
      if (i % 2 === 0) ctx.page.drawRectangle({ x: tx0, y: ry, width: tw, height: 20, color: C.paper });
      text(ctx, r.label, cols[0]! + 5, ry + 7, 8, r.key === "ivt" ? b : f, C.ink);
      text(ctx, fmt(r.prev), cols[1]! + 5, ry + 7, 8, f, C.ink);
      text(ctx, fmt(r.cur), cols[2]! + 5, ry + 7, 8, f, C.ink);
      const d = r.diff;
      const ds = d === null ? "—" : (d > 0 ? "+" : "") + fmt(d);
      text(ctx, ds, cols[3]! + 5, ry + 7, 8, b, d === null || d === 0 ? C.mute : d > 0 ? C.red : C.green);
    });
    const ivtRow = rows.find((r) => r.key === "ivt");
    const msg =
      ivtRow?.diff == null
        ? "No hay datos suficientes para comparar el IVT."
        : ivtRow.diff > 0
          ? `La vulnerabilidad del hogar aumentó ${fmt(ivtRow.diff)} puntos frente a la medición anterior.`
          : ivtRow.diff < 0
            ? `La vulnerabilidad del hogar disminuyó ${fmt(Math.abs(ivtRow.diff))} puntos frente a la medición anterior.`
            : "La vulnerabilidad del hogar se mantiene igual que en la medición anterior.";
    const my = top - 18 - 5 * 20 - 14;
    wrap(msg, b, 8, tw).forEach((l, i) => text(ctx, l, tx0, my - i * 10, 8, b, C.navy));
    ctx.y = baseY - 44;
  }

  // ---------- Photo & signature ----------
  const photoQ = visible.find((q) => q.type === "photo");
  const sigQ = visible.find((q) => q.type === "signature");
  if (photoQ || sigQ) {
    const photo = await embedDataUrl(doc, photoQ ? input.media?.[photoQ.id] : undefined);
    const sig = await embedDataUrl(doc, sigQ ? input.media?.[sigQ.id] : undefined);
    sectionTitle(ctx, "Registro de la persona encuestada", "Fotografía y firma tomadas al momento de la encuesta.");
    ensure(ctx, 170);
    const top = ctx.y;
    const bh = 150;
    const pw = 130;
    ctx.page.drawRectangle({ x: M, y: top - bh, width: pw, height: bh, color: C.white, borderColor: C.line, borderWidth: 1 });
    if (photo) {
      const s = Math.min((pw - 10) / photo.width, (bh - 26) / photo.height);
      const w = photo.width * s;
      const h = photo.height * s;
      ctx.page.drawImage(photo, { x: M + (pw - w) / 2, y: top - 8 - h, width: w, height: h });
    } else text(ctx, "Sin fotografía", M + 30, top - bh / 2, 8, f, C.mute);
    text(ctx, "Fotografía", M + 8, top - bh + 7, 7.5, b, C.mute);
    const sx = M + pw + 14;
    const sw = W - M - sx;
    ctx.page.drawRectangle({ x: sx, y: top - bh, width: sw, height: bh, color: C.white, borderColor: C.line, borderWidth: 1 });
    if (sig) {
      const s = Math.min((sw - 30) / sig.width, (bh - 50) / sig.height);
      const w = sig.width * s;
      const h = sig.height * s;
      ctx.page.drawImage(sig, { x: sx + (sw - w) / 2, y: top - 30 - h + 6, width: w, height: h });
    } else text(ctx, "Sin firma", sx + sw / 2 - 18, top - bh / 2, 8, f, C.mute);
    ctx.page.drawLine({ start: { x: sx + 20, y: top - bh + 22 }, end: { x: sx + sw - 20, y: top - bh + 22 }, thickness: 0.8, color: C.ink });
    text(ctx, "Firma de la persona encuestada", sx + 20, top - bh + 10, 7.5, b, C.mute);
    ctx.y = top - bh - 20;
  }

  // ---------- Variables table ----------
  sectionTitle(ctx, "Variables registradas", "Respuestas de la encuesta agrupadas por sección. La columna «Índice» muestra el componente y el puntaje de vulnerabilidad de cada respuesta.");
  const colQ = M;
  const colA = M + 215;
  const colI = W - M - 92;
  const header = () => {
    ctx.page.drawRectangle({ x: M, y: ctx.y - 18, width: W - 2 * M, height: 18, color: C.navy });
    text(ctx, "Pregunta", colQ + 6, ctx.y - 12, 7.5, b, C.white);
    text(ctx, "Respuesta", colA + 6, ctx.y - 12, 7.5, b, C.white);
    text(ctx, "Índice", colI + 6, ctx.y - 12, 7.5, b, C.white);
    ctx.y -= 18;
  };
  header();
  let sec = "";
  let n = 0;
  let zebra = false;
  for (const q of visible) {
    n++;
    if ((q.sec || "") !== sec) {
      sec = q.sec || "";
      if (sec) {
        if (ctx.y - 40 < 60) {
          newPage(ctx);
          header();
        }
        ctx.page.drawRectangle({ x: M, y: ctx.y - 16, width: W - 2 * M, height: 16, color: hex("#fff4cc") });
        text(ctx, sec.toUpperCase(), M + 6, ctx.y - 11, 7.5, b, C.navy);
        ctx.y -= 16;
      }
    }
    const a = isMediaType(q) ? input.media?.[q.id] : input.answers[q.id];
    const qLines = wrap(`${n}. ${q.text}`, f, 8, colA - colQ - 12);
    const aLines = wrap(answerText(q, a), b, 8, colI - colA - 12);
    const risk = questionRisk(q, a);
    const rowH = Math.max(qLines.length, aLines.length, q.dim && canScore(q) ? 2 : 1) * 10 + 8;
    if (ctx.y - rowH < 60) {
      newPage(ctx);
      header();
    }
    if (zebra) ctx.page.drawRectangle({ x: M, y: ctx.y - rowH, width: W - 2 * M, height: rowH, color: C.paper });
    zebra = !zebra;
    qLines.forEach((l, i) => text(ctx, l, colQ + 6, ctx.y - 11 - i * 10, 8, f, C.ink));
    aLines.forEach((l, i) => text(ctx, l, colA + 6, ctx.y - 11 - i * 10, 8, b, a === undefined || a === "" ? C.grey : C.ink));
    if (q.dim && canScore(q)) {
      text(ctx, dimLabel(q.dim), colI + 6, ctx.y - 11, 7, f, C.mute);
      if (risk !== null) {
        const lv = levelOf(risk);
        ctx.page.drawCircle({ x: colI + 10, y: ctx.y - 19, size: 3, color: hex(lv.hex) });
        text(ctx, `${fmt(risk, 0)} · ${lv.label}`, colI + 17, ctx.y - 21.5, 7.5, b, hex(lv.hex));
      }
    }
    ctx.page.drawLine({ start: { x: M, y: ctx.y - rowH }, end: { x: W - M, y: ctx.y - rowH }, thickness: 0.4, color: C.line });
    ctx.y -= rowH;
  }
  ctx.y -= 18;

  // ---------- Methodology ----------
  const methodology = [
    "1. Cada pregunta de opción se asigna a un componente (Vivienda, Medios de vida o SST) y cada opción a un nivel de riesgo: Bajo = 0, Medio = 50, Alto = 100. En selección múltiple se toma la opción de mayor riesgo; en escalas de 1 a 5 el valor se convierte linealmente a 0–100.",
    "2. El puntaje de cada componente es el promedio de sus preguntas respondidas.",
    "3. IVT = (Vivienda + Medios de vida + SST) / 3, con pesos iguales de un tercio. Si un componente no tiene datos, se promedian los disponibles.",
    "4. Niveles: Bajo (0–24,9), Medio (25–49,9), Alto (50–74,9) y Crítico (75–100).",
    "5. El cruce compara este registro con el anterior del mismo código de hogar.",
  ];
  const mLines = methodology.flatMap((p) => wrap(p, f, 8, W - 2 * M - 24));
  const mh = mLines.length * 10.5 + 34;
  ensure(ctx, mh + 10);
  ctx.page.drawRectangle({ x: M, y: ctx.y - mh, width: W - 2 * M, height: mh, color: hex("#eef2fd"), borderColor: hex("#c8d4fa"), borderWidth: 1 });
  text(ctx, "Metodología del índice", M + 12, ctx.y - 18, 10, b, C.navy);
  mLines.forEach((l, i) => text(ctx, l, M + 12, ctx.y - 34 - i * 10.5, 8, f, C.ink));
  ctx.y -= mh + 10;

  // ---------- Footers ----------
  const pages = doc.getPages();
  const gen = fmtDate(new Date().toISOString());
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.6, color: C.line });
    p.drawText(pdfSafe("UNGRD · Documento confidencial: contiene datos personales. Úselo solo para el seguimiento del hogar."), {
      x: M,
      y: 27,
      size: 7,
      font: f,
      color: C.mute,
    });
    p.drawText(pdfSafe(`Generado el ${gen}`), { x: M, y: 17, size: 6.5, font: f, color: C.grey });
    const s = `Página ${i + 1} de ${pages.length}`;
    p.drawText(pdfSafe(s), { x: W - M - b.widthOfTextAtSize(pdfSafe(s), 7.5), y: 27, size: 7.5, font: b, color: C.navy });
  });

  return doc.save();
}

export function reportFileName(title: string, code?: string): string {
  const base = (code ? `informe-${code}-` : "informe-") + title;
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) + ".pdf"
  );
}
