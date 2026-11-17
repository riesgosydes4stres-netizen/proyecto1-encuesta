import { describe, expect, it } from "vitest";
import { withRespondentFields, withSavedRespondentFields } from "@/lib/survey-defaults";
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

  it("adds optional signature and photo to existing surveys without changing their questions", () => {
    const original: SurveyDoc["questions"] = [
      { id: "old", type: "short", text: "Nombre", req: true, opts: [] },
    ];
    const result = withSavedRespondentFields(original);
    expect(result.slice(0, 1)).toEqual(original);
    expect(original).toHaveLength(1);
    expect(result.slice(1).map((q) => [q.type, q.req])).toEqual([["signature", false], ["photo", false]]);
  });

  it("keeps saved media IDs stable across owner and public reads, without collisions", () => {
    const original: SurveyDoc["questions"] = [
      { id: "respondent-signature", type: "short", text: "Código", req: false, opts: [] },
    ];
    const first = withSavedRespondentFields(original);
    expect(withSavedRespondentFields(original)).toEqual(first);
    expect(first.find((q) => q.type === "signature")?.id).toBe("respondent-signature-1");
    expect(new Set(first.map((q) => q.id)).size).toBe(first.length);
    expect(withSavedRespondentFields(first)).toEqual(first);
  });

  it("preserves existing signatures and adds only a missing photo", () => {
    const original: SurveyDoc["questions"] = [
      { id: "signed", type: "signature", text: "Firma", req: true, opts: [] },
    ];
    const result = withSavedRespondentFields(original);
    expect(result[0]).toEqual(original[0]);
    expect(result.filter((q) => q.type === "signature")).toHaveLength(1);
    expect(result.filter((q) => q.type === "photo")).toHaveLength(1);
  });
});