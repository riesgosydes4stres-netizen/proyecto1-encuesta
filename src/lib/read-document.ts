import { htmlATexto } from "./survey-parser";

type MammothLike = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

async function loadMammoth(): Promise<MammothLike> {
  // Browser-only build; loaded on demand so it never runs during SSR.
  const mod = (await import("mammoth/mammoth.browser.js")) as unknown as { default?: MammothLike } & MammothLike;
  return mod.default ?? mod;
}

async function docxTexto(buf: ArrayBuffer): Promise<string> {
  const mammoth = await loadMammoth();
  try {
    const r = await mammoth.convertToHtml({ arrayBuffer: buf });
    return htmlATexto(r.value);
  } catch {
    const r = await mammoth.extractRawText({ arrayBuffer: buf });
    return r.value;
  }
}

/** Reads a .docx, .txt or .md file into plain text, like the original leerTexto(). */
export async function readDocumentText(f: File): Promise<string> {
  const n = f.name.toLowerCase();
  if (n.endsWith(".docx")) {
    try {
      return await docxTexto(await f.arrayBuffer());
    } catch {
      throw new Error("No se pudo leer el documento.");
    }
  }
  if (/\.(txt|md)$/.test(n) || f.type === "text/plain") {
    return await f.text();
  }
  throw new Error("Use un archivo .docx, .txt o .md.");
}

export function fileBaseName(f: File): string {
  return f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ");
}
