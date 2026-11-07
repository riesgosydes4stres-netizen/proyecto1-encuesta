import { describe, expect, it } from "vitest";
import { cleanPersonalInfo } from "@/lib/profile";

describe("personal info validation", () => {
  it("requires the full name", () => {
    expect(cleanPersonalInfo({ name: "   " }).error).toBe("Escriba su nombre completo.");
  });

  it("accepts a name with optional fields empty and trims spaces", () => {
    const r = cleanPersonalInfo({ name: "  Ana   María  Pérez " });
    expect(r.error).toBeNull();
    expect(r.info.name).toBe("Ana María Pérez");
  });

  it("requires a document type when a number is given", () => {
    expect(cleanPersonalInfo({ name: "Ana", document_number: "1020304050" }).error).toBe("Elija el tipo de documento.");
    expect(cleanPersonalInfo({ name: "Ana", document_type: "CC", document_number: "1020304050" }).error).toBeNull();
  });

  it("rejects unknown document types", () => {
    expect(cleanPersonalInfo({ name: "Ana", document_type: "XX", document_number: "123" }).error).toBe(
      "Elija un tipo de documento de la lista.",
    );
  });

  it("accepts phones with 7 to 15 digits only", () => {
    expect(cleanPersonalInfo({ name: "Ana", phone: "300 123 4567" }).error).toBeNull();
    expect(cleanPersonalInfo({ name: "Ana", phone: "12345" }).error).not.toBeNull();
    expect(cleanPersonalInfo({ name: "Ana", phone: "abc1234567" }).error).not.toBeNull();
  });
});
