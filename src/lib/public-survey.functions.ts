import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeQuestions } from "./surveys";

/** Public read of a published survey (title, description, questions) for the answer page. */
export const getPublicSurvey = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.id ?? "")) throw new Error("Enlace inválido");
    return { id: input.id };
  })
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: row, error } = await sb
      .from("surveys")
      .select("id,title,description,questions,user_id")
      .eq("id", data.id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) {
      console.error("getPublicSurvey", error);
      return { survey: null };
    }
    if (!row) return { survey: null };
    return {
      survey: {
        id: row.id,
        title: row.title,
        description: row.description,
        ownerId: row.user_id,
        questions: normalizeQuestions(row.questions),
      },
    };
  });
