<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The survey text parser lives in `src/lib/survey-parser.js` (plain JS with a `.d.ts`) so its heuristics stay comparable with the original app; change rules there and keep `src/test/survey-parser.test.ts` passing.
- Saved surveys are read and written from the browser through the generated client; owner-only RLS on `surveys` is the security boundary.
- AI survey drafting runs only in the signed-in `generateSurveyText` server function; never call the AI from browser code.
- Landing/creator styles are hand-written component classes in `src/styles.css` scoped under `.encuesta`; colors come from the brand tokens defined there.
- Published surveys are readable by anyone (answer link), so every "my surveys" query must also filter by `user_id`.
- Responses are inserted from the browser (anonymous allowed) only into published surveys; a BEFORE INSERT trigger sets the owner and caps sizes. Photo/signature data URLs live in the separate `media` column so list queries never load them; only the survey owner can read responses.
- Vulnerability index rules (scoring, weights, levels, household-code matching) live only in `src/lib/vulnerability.ts`, covered by `src/test/vulnerability.test.ts`; UI and PDF must call it instead of re-implementing math.
- The household report PDF is built with pdf-lib standard fonts in `src/lib/report-pdf.ts` (no DOM), so the same code can run in the browser and on the server; pass all text through `pdfSafe`.
