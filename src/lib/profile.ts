import { supabase } from "@/integrations/supabase/client";

export interface PersonalInfo {
  name: string;
  document_type: string;
  document_number: string;
  phone: string;
  position: string;
  organization: string;
  municipality: string;
}

export const EMPTY_INFO: PersonalInfo = {
  name: "",
  document_type: "",
  document_number: "",
  phone: "",
  position: "",
  organization: "",
  municipality: "",
};

export const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PPT", label: "Permiso por protección temporal" },
  { value: "PA", label: "Pasaporte" },
] as const;

export const LIMITS: Record<keyof PersonalInfo, number> = {
  name: 120,
  document_type: 10,
  document_number: 30,
  phone: 30,
  position: 120,
  organization: 160,
  municipality: 120,
};

/** Trims every field and returns a Spanish error message, or null when valid. */
export function cleanPersonalInfo(raw: Partial<Record<keyof PersonalInfo, unknown>>): { info: PersonalInfo; error: string | null } {
  const info = { ...EMPTY_INFO };
  for (const k of Object.keys(EMPTY_INFO) as (keyof PersonalInfo)[]) {
    info[k] = String(raw[k] ?? "").trim().replace(/\s+/g, " ");
  }
  if (!info.name) return { info, error: "Escriba su nombre completo." };
  for (const k of Object.keys(LIMITS) as (keyof PersonalInfo)[]) {
    if (info[k].length > LIMITS[k]) return { info, error: "Uno de los campos es demasiado largo." };
  }
  if (info.document_type && !DOCUMENT_TYPES.some((d) => d.value === info.document_type)) {
    return { info, error: "Elija un tipo de documento de la lista." };
  }
  if (info.document_number && !/^[A-Za-z0-9.\-]{3,30}$/.test(info.document_number)) {
    return { info, error: "El número de documento solo puede tener letras, números, puntos o guiones." };
  }
  if (info.document_number && !info.document_type) return { info, error: "Elija el tipo de documento." };
  if (info.phone) {
    const digits = info.phone.replace(/\D/g, "");
    if (!/^[+\d\s()\-]+$/.test(info.phone) || digits.length < 7 || digits.length > 15) {
      return { info, error: "Escriba un teléfono válido (entre 7 y 15 dígitos)." };
    }
  }
  return { info, error: null };
}

export async function getPersonalInfo(userId: string): Promise<PersonalInfo> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, document_type, document_number, phone, position, organization, municipality")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return { ...EMPTY_INFO, ...(data ?? {}) };
}

export async function savePersonalInfo(userId: string, info: PersonalInfo): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...info }, { onConflict: "id" });
  if (error) throw error;
}
