import { describe, expect, it } from "vitest";
import { htmlATexto, parse } from "@/lib/survey-parser";

describe("manual document import", () => {
  it("keeps bold Word fields as questions instead of section headings", () => {
    const doc = parse(htmlATexto(`<h1>Caracterización del hogar</h1>
      <h2>Datos del hogar</h2><p><strong>Nombre completo: ________</strong></p>
      <p><strong>Fecha de la entrevista: ________</strong></p>`));
    expect(doc.questions.map((q) => q.type)).toEqual(["short", "date"]);
    expect(doc.questions.map((q) => q.text)).toEqual(["Nombre completo", "Fecha de la entrevista"]);
    expect(doc.questions.every((q) => q.sec === "Datos del hogar")).toBe(true);
  });

  it("separates inline checkboxes from the question", () => {
    const doc = parse("Seguimiento\n1. ¿Tiene empleo? ☐ Sí ☐ No");
    expect(doc.questions[0]?.text).toBe("¿Tiene empleo?");
    expect(doc.questions[0]?.opts).toEqual(["Sí", "No"]);
    expect(doc.questions[0]?.type).toBe("single");
  });

  it("does not turn an unnumbered field before a table into a section", () => {
    const doc = parse(htmlATexto(`<h1>Seguimiento</h1>
      <p>Fecha de la entrevista: ________</p><table>
      <tr><td>Edad</td><td>________</td></tr></table>`));
    expect(doc.questions.map((q) => q.type)).toEqual(["date", "number"]);
  });

  it("imports a Word form table as separate fields, not a matrix", () => {
    const doc = parse(htmlATexto(`<h1>Datos del hogar</h1><table>
      <tr><td>Nombre completo</td><td>________</td></tr>
      <tr><td>Edad</td><td>________</td></tr>
      <tr><td>¿Tiene empleo?</td><td>☐ Sí ☐ No</td></tr>
    </table>`));
    expect(doc.questions.map((q) => q.type)).toEqual(["short", "number", "single"]);
    expect(doc.questions[2]?.opts).toEqual(["Sí", "No"]);
  });

  it("preserves Word automatic questions and nested answer options", () => {
    const doc = parse(htmlATexto(`<h1>Seguimiento</h1><ol><li>¿Tiene empleo?
      <ul><li>Sí</li><li>No</li></ul></li><li>Observaciones (párrafo)</li></ol>`));
    expect(doc.questions.map((q) => q.type)).toEqual(["single", "long"]);
    expect(doc.questions[0]?.opts).toEqual(["Sí", "No"]);
  });

  it("retains a real Word matrix with its rows and columns", () => {
    const doc = parse(htmlATexto(`<h1>Seguimiento</h1><p>1. Servicios (matriz)</p>
      <table><tr><td>Servicio</td><td>Sí</td><td>No</td></tr>
      <tr><td>Agua</td><td></td><td></td></tr><tr><td>Energía</td><td></td><td></td></tr></table>`));
    expect(doc.questions[0]?.rows).toEqual(["Agua", "Energía"]);
    expect(doc.questions[0]?.cols).toEqual(["Sí", "No"]);
  });
});