import logo from "@/assets/ungrd-logo.jpg.asset.json";
import { buildReportPdf, type ReportInput } from "./report-pdf";

let logoPromise: Promise<Uint8Array | null> | null = null;
function loadLogo(): Promise<Uint8Array | null> {
  logoPromise ??= fetch(logo.url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? new Uint8Array(b) : null))
    .catch(() => null);
  return logoPromise;
}

export async function makeReportBlob(input: Omit<ReportInput, "logo">): Promise<Blob> {
  const bytes = await buildReportPdf({ ...input, logo: await loadLogo() });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** On phones, offers the share sheet ("Guardar en Archivos"); otherwise downloads. */
export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
