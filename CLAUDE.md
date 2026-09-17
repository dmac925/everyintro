# EveryIntro — notes for AI assistants

Read README.md first. House rules that aren't obvious from the code:

- **`src/lib/server/**` uses relative imports only** (no `$lib`, no `$env`). `workers/jobs` bundles these files with wrangler, which can't resolve SvelteKit aliases. App-only modules (`platform.ts`, `guards.ts`) may import `@sveltejs/kit`, but nothing the jobs worker reaches may.
- **Every page load and form action checks auth itself** (`requireUser`, `requireCompany`). Layout loads run in parallel with page loads and don't run for actions, so they aren't a guard.
- **Blind by default.** Employers never see candidate name, email or salary floor except through an accepted intro (`/company/intros` selects contact columns only when `status = 'accepted'`). Keep it that way in any new query.
- **Cost guardrails live in `src/lib/config.ts`.** Before adding a recurring job, raising a cap or switching models, estimate the spend and check `/admin` (measured from `llm_usage`). Log usage for every new Claude call with `logUsage`.
- Claude calls go through `claude(env)` with `...FALLBACK` (server-side refusal fallbacks; not available on the Batches API). Model is `MODEL` in config.
- Intake prompts in `server/intake/prompts.ts` are frozen strings so they prompt-cache. Don't interpolate per-user data into them.
- Style: tabs, single quotes, Svelte 5 runes, Tailwind v4 tokens from `routes/layout.css`.
- Checks: `npm run check` (app) and `npx tsc -p workers/jobs/tsconfig.json` (worker).
- **Design system is in `src/routes/layout.css`** (tokens + component classes), taken from the Claude Design canvas in `EveryIntro mobile redesign/`. Cream ground, ink header/primary, one amber accent, Newsreader for headings (weight 400 only, never `font-bold` on a heading), Manrope for text. Use the classes (`.btn`, `.btn-amber`, `.btn-ghost`, `.panel`, `.label`, `.ledger*`, `.table-wrap`, `.chip`) before inventing new styles. Single theme by design; no dark mode.
- **No em dashes in site copy.** Commas, full stops or colons instead. `npm run check` fails on one (`scripts/no-em-dash.mjs`); the intake prompts tell the agent the same rule.
- **Positioning.** Brand, tagline and competitor facts live in `src/lib/brand.ts`. Any comparative claim about Jack & Jill or agencies must quote a public source and carry a `checked` date; don't invent metrics for us (we're new — say so).
