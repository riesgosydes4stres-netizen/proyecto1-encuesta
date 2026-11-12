import { describe, expect, it } from "vitest";
import { withRespondentFields } from "@/lib/survey-defaults";
import type { SurveyDoc } from "@/lib/survey-parser";

describe("Respondent fields in new surveys", () => {
  it("includes a signature field even in an empty manual draft", () => {
    const doc = withRespondentFields({ title: "", desc: "", questions: [] });
    expect(doc.questions.filter((q) => q.type === "signature")).toHaveLength(1);
  });

  it("includes a photo field in a generated or imported draft", () => {
    const doc = withRespondentFields({ title: "Hogar", desc: "", questions: [
      { id: "code", type: "short", text: "Código del hogar", req: true, opts: [] },
    ] });
    expect(doc.questions.filter((q) => q.type === "photo")).toHaveLength(1);
    expect(doc.questions[0]?.id).toBe("code");
  });

  it("preserves existing media fields without duplicates", () => {
    const original: SurveyDoc = { title: "Hogar", desc: "", questions: [
      { id: "signature", type: "signature", text: "Firma", req: true, opts: [] },
      { id: "photo", type: "photo", text: "Foto", req: false, opts: [] },
    ] };
    expect(withRespondentFields(withRespondentFields(original))).toEqual(original);
  });
});