import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MAX_PROMPT_CHARS = 60_000;

export function validatePrompt(input: unknown): { prompt: string } {
  const raw = (input as { prompt?: unknown } | null)?.prompt;
  const prompt = typeof raw === "string" ? raw.trim() : "";
  if (!prompt) throw new Error("No se recibió el texto para crear la encuesta.");
  if (prompt.length > MAX_PROMPT_CHARS)
    throw new Error("El texto supera el máximo permitido de 60.000 caracteres.");
  return { prompt };
}

/**
 * Replaces the old Cloudflare Worker POST /generate. Same model and settings
 * (Gemini 3.8 Flash, temperature 0.25, 4096 output tokens); signed-in users only.
 */
export const generateSurveyText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePrompt)
  .handler(async ({ data }): Promise<{ text: string } | { error: string }> => {
    const { generateChatCompletion, GatewayError, RateLimitError, PaymentRequiredError } = await import(
      "@lovable.dev/ai-gateway"
    );
    try {
      const res = await generateChatCompletion({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: data.prompt }],
        temperature: 0.25,
        max_tokens: 4096,
      });
      const content = res.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content.trim() : "";
      if (!text) return { error: "La IA no devolvió texto. Intente de nuevo con una descripción más concreta." };
      return { text };
    } catch (err) {
      if (err instanceof RateLimitError)
        return { error: "Límite temporal alcanzado. Espere un minuto e inténtelo de nuevo." };
      if (err instanceof PaymentRequiredError)
        return { error: "El servicio de IA no está disponible en este momento (sin créditos)." };
      if (err instanceof GatewayError) {
        console.error("AI gateway error", err.code, err.httpStatus, err.ids);
        return { error: "No fue posible conectar con la IA. Inténtelo de nuevo." };
      }
      console.error(err);
      return { error: "No fue posible conectar con la IA. Inténtelo de nuevo." };
    }
  });
